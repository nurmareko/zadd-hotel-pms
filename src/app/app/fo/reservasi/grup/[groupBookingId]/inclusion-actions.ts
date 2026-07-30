"use server";

import {
  ArrangementType,
  ReservationStatus,
  ReservationStayFeeKind,
  ReservationStayFeeStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { MEAL_ARTICLE_CODES } from "@/lib/arrangement-inclusions";
import { hotelTodayDateOnly } from "@/lib/date-only";
import { prisma } from "@/lib/prisma";
import {
  buildReservationMealPlanChange,
  type ExpectedMealPlanPreview,
} from "@/lib/reservation-meal-plan-change";
import {
  changeReservationMealPlan,
  setReservationStayFee,
} from "../../[id]/actions";
import type { GroupRoomActionResult } from "./actions";

const GroupScopeSchema = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("all"),
    reservationIds: z.array(z.number()).optional(),
  }),
  z.object({
    scope: z.literal("selected"),
    reservationIds: z.array(z.number().int().positive()).min(1).max(100),
  }),
]);

const GroupMealPlanSchema = z
  .object({
    groupBookingId: z.string().trim().min(1).max(32),
    arrangementType: z.nativeEnum(ArrangementType),
  })
  .and(GroupScopeSchema);

const ExpectedPreviewSchema = z.discriminatedUnion("eligible", [
  z.object({
    reservationId: z.number().int().positive(),
    groupBookingId: z.string().nullable(),
    reservationStatus: z.nativeEnum(ReservationStatus),
    currentPlan: z.nativeEnum(ArrangementType),
    pax: z.number().int(),
    nightsAffected: z.number().int().positive(),
    unitPrice: z.string(),
    nightlyAmount: z.string(),
    expectedAmount: z.string(),
    effectiveDate: z.string(),
    eligible: z.literal(true),
    reason: z.null(),
  }),
  z.object({
    reservationId: z.number().int().positive(),
    groupBookingId: z.string().nullable(),
    reservationStatus: z.nativeEnum(ReservationStatus).nullable(),
    currentPlan: z.nativeEnum(ArrangementType).nullable(),
    pax: z.number().int().nullable(),
    nightsAffected: z.literal(0),
    unitPrice: z.literal("0"),
    nightlyAmount: z.literal("0"),
    expectedAmount: z.literal("0"),
    effectiveDate: z.null(),
    eligible: z.literal(false),
    reason: z.string().min(1),
  }),
]);

const GroupMealPlanApplySchema = GroupMealPlanSchema.and(
  z.object({ expectedPreviews: z.array(ExpectedPreviewSchema).min(1).max(100) }),
);

const GroupStayFeeSchema = z
  .object({
    groupBookingId: z.string().trim().min(1).max(32),
    kinds: z.array(z.nativeEnum(ReservationStayFeeKind)).min(1).max(2),
  })
  .and(GroupScopeSchema);

type ParsedScope = z.infer<typeof GroupScopeSchema>;

type GroupCandidate = {
  id: number;
  reservationNo: string;
  room: { number: string } | null;
};

export type GroupMealPlanPreviewRoom = {
  reservationId: number;
  reservationNo: string;
  roomNumber: string | null;
  groupBookingId: string | null;
  reservationStatus: ReservationStatus | null;
  currentPlan: ArrangementType | null;
  adults: number | null;
  children: number | null;
  pax: number | null;
  eligible: boolean;
  reason: string | null;
  nightsAffected: number;
  unitPrice: string;
  nightlyAmount: string;
  expectedAmount: string;
  effectiveDate: string | null;
};

export type GroupMealPlanPreviewResult =
  | { ok: true; rooms: GroupMealPlanPreviewRoom[] }
  | { ok: false; error: string };

async function canManageGroupInclusions() {
  const session = await auth();
  return session?.user.role === "FO";
}

function uniqueReservationIds(ids: number[]) {
  return Array.from(new Set(ids));
}

async function resolveCandidates(
  groupBookingId: string,
  selection: ParsedScope,
): Promise<GroupCandidate[]> {
  if (selection.scope === "all") {
    return prisma.reservation.findMany({
      where: { groupBookingId },
      select: {
        id: true,
        reservationNo: true,
        room: { select: { number: true } },
      },
      orderBy: [{ room: { number: "asc" } }, { id: "asc" }],
    });
  }

  const ids = uniqueReservationIds(selection.reservationIds);
  const reservations = await prisma.reservation.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      reservationNo: true,
      room: { select: { number: true } },
    },
  });
  const reservationById = new Map(
    reservations.map((reservation) => [reservation.id, reservation]),
  );

  return ids.map(
    (id) =>
      reservationById.get(id) ?? {
        id,
        reservationNo: `Reservasi #${id}`,
        room: null,
      },
  );
}

function resultFor(
  reservation: GroupCandidate,
  status: GroupRoomActionResult["status"],
  reason: string,
): GroupRoomActionResult {
  return {
    reservationId: reservation.id,
    reservationNo: reservation.reservationNo,
    roomNumber: reservation.room?.number ?? null,
    status,
    reason,
  };
}

function revalidateGroupInclusions(groupBookingId: string) {
  try {
    revalidatePath(`/app/fo/reservasi/grup/${groupBookingId}`);
    revalidatePath("/app/fo/reservasi/list");
  } catch (error) {
    console.error("Gagal menyegarkan tampilan Inklusi grup", error);
  }
}

export async function previewGroupMealPlan(
  input: unknown,
): Promise<GroupMealPlanPreviewResult> {
  if (!(await canManageGroupInclusions())) {
    return { ok: false, error: "Tidak diizinkan" };
  }

  const parsed = GroupMealPlanSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Permintaan pratinjau meal plan tidak valid." };
  }

  const { groupBookingId, arrangementType, ...selection } = parsed.data;
  const boundary = hotelTodayDateOnly();
  const candidates = await resolveCandidates(groupBookingId, selection);

  if (candidates.length === 0) {
    return { ok: false, error: "Tidak ada reservasi dalam booking grup ini." };
  }

  const reservations = await prisma.reservation.findMany({
    where: { id: { in: candidates.map((candidate) => candidate.id) } },
    select: {
      id: true,
      reservationNo: true,
      groupBookingId: true,
      status: true,
      arrangementType: true,
      adults: true,
      children: true,
      room: { select: { number: true } },
      roomType: { select: { capacity: true } },
      reservationNights: {
        where: { date: { gte: boundary } },
        orderBy: { date: "asc" },
        select: {
          id: true,
          date: true,
          folioLineItems: {
            where: { article: { code: { in: [...MEAL_ARTICLE_CODES] } } },
            take: 1,
            select: { id: true },
          },
        },
      },
    },
  });
  const reservationById = new Map(
    reservations.map((reservation) => [reservation.id, reservation]),
  );

  const rooms = candidates.map((candidate): GroupMealPlanPreviewRoom => {
    const reservation = reservationById.get(candidate.id);
    if (!reservation || reservation.groupBookingId !== groupBookingId) {
      return {
        reservationId: candidate.id,
        reservationNo: candidate.reservationNo,
        roomNumber: candidate.room?.number ?? null,
        groupBookingId: reservation?.groupBookingId ?? null,
        reservationStatus: reservation?.status ?? null,
        currentPlan: reservation?.arrangementType ?? null,
        adults: reservation?.adults ?? null,
        children: reservation?.children ?? null,
        pax: reservation ? reservation.adults + reservation.children : null,
        eligible: false,
        reason: "Reservasi bukan anggota booking grup ini.",
        nightsAffected: 0,
        unitPrice: "0",
        nightlyAmount: "0",
        expectedAmount: "0",
        effectiveDate: null,
      };
    }

    const pax = reservation.adults + reservation.children;
    const change = buildReservationMealPlanChange({
      reservationId: reservation.id,
      groupBookingId: reservation.groupBookingId,
      expectedGroupBookingId: groupBookingId,
      status: reservation.status,
      currentPlan: reservation.arrangementType,
      targetPlan: arrangementType,
      adults: reservation.adults,
      children: reservation.children,
      roomCapacity: reservation.roomType.capacity,
      nights: reservation.reservationNights.map((night) => ({
        id: night.id,
        date: night.date,
        posted: night.folioLineItems.length > 0,
      })),
    });

    return {
      reservationId: reservation.id,
      reservationNo: reservation.reservationNo,
      roomNumber: reservation.room?.number ?? null,
      groupBookingId: reservation.groupBookingId,
      reservationStatus: reservation.status,
      currentPlan: reservation.arrangementType,
      adults: reservation.adults,
      children: reservation.children,
      pax,
      eligible: change.ok,
      reason: change.ok ? null : change.error,
      nightsAffected: change.ok ? change.snapshot.nightsAffected : 0,
      unitPrice: change.ok ? change.snapshot.unitPrice : "0",
      nightlyAmount: change.ok ? change.snapshot.nightlyAmount : "0",
      expectedAmount: change.ok ? change.snapshot.expectedAmount : "0",
      effectiveDate: change.ok ? change.snapshot.effectiveDate : null,
    };
  });

  return { ok: true, rooms };
}

export async function applyGroupMealPlan(
  input: unknown,
): Promise<
  | { ok: true; results: GroupRoomActionResult[] }
  | { ok: false; error: string }
> {
  if (!(await canManageGroupInclusions())) {
    return { ok: false, error: "Tidak diizinkan" };
  }

  const parsed = GroupMealPlanApplySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Permintaan meal plan grup tidak valid." };
  }

  const {
    groupBookingId,
    arrangementType,
    expectedPreviews,
    scope,
    reservationIds,
  } = parsed.data;
  const selection: ParsedScope =
    scope === "all"
      ? { scope }
      : { scope, reservationIds: reservationIds ?? [] };
  const candidates = await resolveCandidates(groupBookingId, selection);
  if (candidates.length === 0) {
    return { ok: false, error: "Tidak ada reservasi dalam booking grup ini." };
  }

  const previewByReservationId = new Map(
    expectedPreviews.map((preview) => [preview.reservationId, preview]),
  );
  const candidateIds = candidates.map((candidate) => candidate.id).sort((a, b) => a - b);
  const previewIds = Array.from(previewByReservationId.keys()).sort((a, b) => a - b);
  if (
    previewByReservationId.size !== expectedPreviews.length ||
    candidateIds.length !== previewIds.length ||
    candidateIds.some((id, index) => id !== previewIds[index])
  ) {
    return {
      ok: false,
      error:
        "Cakupan kamar berubah setelah pratinjau. Tampilkan pratinjau baru sebelum menerapkan meal plan.",
    };
  }

  const results: GroupRoomActionResult[] = [];

  // No outer transaction: every eligible room keeps the canonical action's
  // serializable transaction so partial success is durable and retryable.
  for (const reservation of candidates) {
    const expected = previewByReservationId.get(reservation.id)!;
    const expectedPreview: ExpectedMealPlanPreview | undefined = expected.eligible
      ? {
          reservationId: expected.reservationId,
          groupBookingId: expected.groupBookingId,
          reservationStatus: expected.reservationStatus,
          currentPlan: expected.currentPlan,
          pax: expected.pax,
          nightsAffected: expected.nightsAffected,
          unitPrice: expected.unitPrice,
          nightlyAmount: expected.nightlyAmount,
          expectedAmount: expected.expectedAmount,
          effectiveDate: expected.effectiveDate,
        }
      : undefined;
    const expectedIneligiblePreview = !expected.eligible
      ? {
          reservationId: expected.reservationId,
          groupBookingId: expected.groupBookingId,
          reservationStatus: expected.reservationStatus,
          currentPlan: expected.currentPlan,
          pax: expected.pax,
          reason: expected.reason,
        }
      : undefined;

    try {
      const result = await changeReservationMealPlan({
        reservationId: reservation.id,
        arrangementType,
        expectedGroupBookingId: groupBookingId,
        expectedPreview,
        expectedIneligiblePreview,
      });

      results.push(
        result.ok
          ? resultFor(
              reservation,
              "completed",
              `Meal plan diterapkan mulai ${result.effectiveDate} untuk ${result.changedNights} malam.`,
            )
          : resultFor(
              reservation,
              result.disposition === "skipped" ? "skipped" : "failed",
              result.error,
            ),
      );
    } catch (error) {
      results.push(
        resultFor(
          reservation,
          "failed",
          error instanceof Error
            ? error.message
            : "Terjadi kegagalan saat memproses kamar ini.",
        ),
      );
    }
  }

  revalidateGroupInclusions(groupBookingId);
  return { ok: true, results };
}

const stayFeeLabels: Record<ReservationStayFeeKind, string> = {
  EARLY_CHECK_IN: "Check-in lebih awal",
  LATE_CHECK_OUT: "Check-out lebih lambat",
};

function feeOutcomeReason(
  kind: ReservationStayFeeKind,
  status: ReservationStayFeeStatus,
  changed: boolean,
) {
  const label = stayFeeLabels[kind];
  if (!changed) return `${label} sudah dipilih; dilewati.`;
  if (status === ReservationStayFeeStatus.POSTED) {
    return `${label} langsung terposting Rp100.000 ke folio kamar.`;
  }
  return `${label} disimpan PENDING Rp100.000 untuk kamar ini.`;
}

export async function applyGroupStayFees(
  input: unknown,
): Promise<
  | { ok: true; results: GroupRoomActionResult[] }
  | { ok: false; error: string }
> {
  if (!(await canManageGroupInclusions())) {
    return { ok: false, error: "Tidak diizinkan" };
  }

  const parsed = GroupStayFeeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Permintaan biaya fleksibilitas grup tidak valid." };
  }

  const { groupBookingId, kinds, ...selection } = parsed.data;
  const candidates = await resolveCandidates(groupBookingId, selection);
  if (candidates.length === 0) {
    return { ok: false, error: "Tidak ada reservasi dalam booking grup ini." };
  }

  const uniqueKinds = Array.from(new Set(kinds));
  const results: GroupRoomActionResult[] = [];

  // Each kind delegates to the canonical per-room fee action. Its unique row and
  // serializable transaction provide idempotence without a group transaction.
  for (const reservation of candidates) {
    const details: NonNullable<GroupRoomActionResult["details"]> = [];
    let completed = false;
    let failed = false;

    for (const kind of uniqueKinds) {
      try {
        const result = await setReservationStayFee({
          reservationId: reservation.id,
          kind,
          selected: true,
          expectedGroupBookingId: groupBookingId,
        });

        if (result.ok) {
          completed ||= result.changed;
          details.push({
            label: stayFeeLabels[kind],
            status: result.changed ? "completed" : "skipped",
            reason: feeOutcomeReason(kind, result.status, result.changed),
          });
        } else {
          const status =
            result.disposition === "skipped" ? "skipped" : "failed";
          failed ||= status === "failed";
          details.push({ label: stayFeeLabels[kind], status, reason: result.error });
        }
      } catch (error) {
        failed = true;
        details.push({
          label: stayFeeLabels[kind],
          status: "failed",
          reason:
            error instanceof Error
              ? error.message
              : "Terjadi kegagalan saat memproses kamar ini.",
        });
      }
    }

    const status = failed ? "failed" : completed ? "completed" : "skipped";
    const summary =
      failed && completed
        ? "Sebagian biaya berhasil diterapkan; lihat hasil per jenis."
        : status === "completed"
          ? "Semua biaya terpilih berhasil diterapkan."
          : status === "failed"
            ? "Biaya gagal diterapkan; lihat hasil per jenis."
            : "Semua biaya terpilih sudah ada atau terkunci.";
    results.push({ ...resultFor(reservation, status, summary), details });
  }

  revalidateGroupInclusions(groupBookingId);
  return { ok: true, results };
}
