"use server";

import {
  DepositStatus,
  FolioStatus,
  PaymentMethod,
  ReservationStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { dateOnlyBoundary, todayDateOnly } from "@/lib/date-only";
import { formatDateID } from "@/lib/format";
import { computeFolioTotals } from "@/lib/folio-totals";
import { prisma } from "@/lib/prisma";
import { collectCheckInDepositForGroup } from "@/lib/check-in/actions";
import { checkInDepositMethods } from "@/lib/check-in/schema";
import {
  completeCheckout,
  recordFinalPayment,
} from "../../../check-out/[folioId]/actions";

const GroupBookingIdSchema = z.string().trim().min(1, "Booking grup tidak valid");

const GroupDepositSchema = z
  .object({
    groupBookingId: GroupBookingIdSchema,
    method: z.enum(checkInDepositMethods),
    reference: z.string().trim().max(100).optional(),
  })
  .superRefine(requireTransferReference);

const SettleGroupBalancesSchema = z
  .object({
    groupBookingId: GroupBookingIdSchema,
    method: z.enum(PaymentMethod),
    reference: z.string().trim().max(100).optional(),
  })
  .superRefine(requireTransferReference);

function requireTransferReference(
  value: { method: PaymentMethod; reference?: string },
  ctx: z.RefinementCtx,
) {
  if (value.method === PaymentMethod.TRANSFER && !value.reference) {
    ctx.addIssue({
      code: "custom",
      path: ["reference"],
      message: "Referensi wajib diisi untuk pembayaran transfer",
    });
  }
}

type GroupActionStatus = "completed" | "skipped" | "failed";

export type GroupRoomActionResult = {
  reservationId: number;
  reservationNo: string;
  roomNumber: string | null;
  status: GroupActionStatus;
  reason: string;
};

export type GroupActionResult =
  | { ok: true; results: GroupRoomActionResult[] }
  | { ok: false; error: string };

type DelegatedActionResult = { ok: true } | { ok: false; error: string };

function roomLabel(room: { number: string } | null) {
  return room?.number ?? null;
}

function resultFor(
  reservation: {
    id: number;
    reservationNo: string;
    room: { number: string } | null;
  },
  status: GroupActionStatus,
  reason: string,
): GroupRoomActionResult {
  return {
    reservationId: reservation.id,
    reservationNo: reservation.reservationNo,
    roomNumber: roomLabel(reservation.room),
    status,
    reason,
  };
}

async function canManageGroupCheckout() {
  const session = await auth();
  return session?.user.role === "FO";
}

function actionFormData(entries: Record<string, string>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }

  return formData;
}

function revalidateGroup(groupBookingId: string) {
  try {
    revalidatePath(`/app/fo/reservasi/grup/${groupBookingId}`);
    revalidatePath("/app/fo/reservasi/list");
  } catch (error) {
    // Financial mutations may already be committed per room. Preserve and
    // return their outcomes even if cache invalidation itself fails.
    console.error("Failed to revalidate group reservation paths", error);
  }
}

function unexpectedActionError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Terjadi kegagalan saat memproses kamar ini.";
}

async function callExistingAction<T extends DelegatedActionResult>(
  action: () => Promise<T>,
): Promise<T | { ok: false; error: string }> {
  try {
    return await action();
  } catch (error) {
    return { ok: false, error: unexpectedActionError(error) };
  }
}

export async function collectGroupDeposits(input: {
  groupBookingId: string;
  method: PaymentMethod;
  reference?: string;
}): Promise<GroupActionResult> {
  if (!(await canManageGroupCheckout())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = GroupDepositSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Data deposit tidak valid",
    };
  }

  const { groupBookingId, method, reference } = parsed.data;
  const { today } = todayDateOnly();
  const reservations = await prisma.reservation.findMany({
    where: { groupBookingId },
    include: {
      room: { select: { number: true } },
    },
    orderBy: [{ room: { number: "asc" } }, { id: "asc" }],
  });

  if (reservations.length === 0) {
    return { ok: false, error: "Tidak ada reservasi dalam booking grup ini." };
  }

  const results: GroupRoomActionResult[] = [];

  // Each sibling deliberately keeps the canonical deposit writer's own
  // serializable transaction. This matches the existing per-room batch model:
  // successful rooms remain collected if a later sibling fails, and every
  // skipped or failed room is returned to the operator.
  for (const reservation of reservations) {
    if (reservation.status !== ReservationStatus.CONFIRMED) {
      const reason =
        reservation.status === ReservationStatus.CHECKED_IN
          ? "Sudah check-in."
          : reservation.status === ReservationStatus.CHECKED_OUT
            ? "Sudah check-out."
            : reservation.status === ReservationStatus.CANCELLED
              ? "Reservasi dibatalkan."
              : "Reservasi no-show.";
      results.push(resultFor(reservation, "skipped", reason));
      continue;
    }

    if (reservation.depositStatus === DepositStatus.COLLECTED) {
      results.push(resultFor(reservation, "skipped", "Deposit sudah dikumpulkan."));
      continue;
    }

    if (dateOnlyBoundary(reservation.arrivalDate) > today) {
      results.push(
        resultFor(
          reservation,
          "skipped",
          `Belum waktunya mengumpulkan deposit (arrival ${formatDateID(reservation.arrivalDate)}).`,
        ),
      );
      continue;
    }

    const deposit = await callExistingAction(() =>
      collectCheckInDepositForGroup({
        reservationId: reservation.id,
        depositMethod: method,
        depositReference: reference,
        groupBookingId,
      }),
    );

    results.push(
      !deposit.ok
        ? resultFor(reservation, "failed", deposit.error)
        : deposit.alreadyCollected
          ? resultFor(reservation, "skipped", "Deposit sudah dikumpulkan.")
          : resultFor(
              reservation,
              "completed",
              `Deposit ${deposit.payment.amount} dicatat pada folio kamar ini.`,
            ),
    );
  }

  revalidateGroup(groupBookingId);
  return { ok: true, results };
}

export async function settleGroupBalances(input: {
  groupBookingId: string;
  method: PaymentMethod;
  reference?: string;
}): Promise<GroupActionResult> {
  if (!(await canManageGroupCheckout())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = SettleGroupBalancesSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Data pembayaran tidak valid",
    };
  }

  const { groupBookingId, method, reference } = parsed.data;
  const [settings, reservations] = await Promise.all([
    prisma.hotelSettings.findUnique({ where: { id: 1 } }),
    prisma.reservation.findMany({
      where: { groupBookingId },
      include: {
        room: { select: { number: true } },
        folio: {
          include: {
            lineItems: { include: { article: true } },
            payments: true,
          },
        },
      },
      orderBy: [{ room: { number: "asc" } }, { id: "asc" }],
    }),
  ]);

  if (!settings) {
    return { ok: false, error: "Hotel settings not found" };
  }

  const results: GroupRoomActionResult[] = [];

  // Every mutation below is deliberately delegated to recordFinalPayment.
  // Its per-folio stay-charge handling, payment write, and activity log remain
  // the single authoritative payment path. Do not wrap this loop in one group
  // transaction: each folio's existing action owns its own consistency boundary.
  for (const reservation of reservations) {
    if (!reservation.folio) {
      results.push(resultFor(reservation, "skipped", "Belum check-in (folio belum dibuat)."));
      continue;
    }
    const folio = reservation.folio;

    if (folio.status !== FolioStatus.OPEN) {
      results.push(
        resultFor(
          reservation,
          "skipped",
          folio.status === FolioStatus.CLOSED
            ? "Folio sudah tertutup."
            : "Folio dibatalkan.",
        ),
      );
      continue;
    }

    if (reservation.status !== ReservationStatus.CHECKED_IN) {
      results.push(resultFor(reservation, "skipped", "Belum check-in."));
      continue;
    }

    const balance = computeFolioTotals(
      folio.lineItems,
      folio.payments,
      settings,
    ).balance;

    if (Math.round(balance) <= 0) {
      results.push(resultFor(reservation, "skipped", "Saldo sudah lunas."));
      continue;
    }

    const payment = await callExistingAction(() =>
      recordFinalPayment(
        actionFormData({
          folioId: String(folio.id),
          amount: String(balance),
          method,
          ...(reference ? { reference } : {}),
        }),
      ),
    );

    if (!payment.ok) {
      results.push(resultFor(reservation, "failed", payment.error));
      continue;
    }

    // recordFinalPayment can post a stay-charge shortfall before creating its
    // payment. Re-read its result rather than reproducing that calculation;
    // a second call uses the same authoritative payment path only when that
    // newly posted charge left a balance behind.
    const updatedFolio = await prisma.folio.findUnique({
      where: { id: folio.id },
      include: {
        lineItems: { include: { article: true } },
        payments: true,
      },
    });

    if (!updatedFolio) {
      results.push(resultFor(reservation, "failed", "Folio tidak ditemukan setelah pembayaran."));
      continue;
    }

    const remainingBalance = computeFolioTotals(
      updatedFolio.lineItems,
      updatedFolio.payments,
      settings,
    ).balance;

    if (Math.round(remainingBalance) <= 0) {
      results.push(resultFor(reservation, "completed", "Saldo folio dilunasi."));
      continue;
    }

    const catchUpPayment = await callExistingAction(() =>
      recordFinalPayment(
        actionFormData({
          folioId: String(updatedFolio.id),
          amount: String(remainingBalance),
          method,
          ...(reference ? { reference } : {}),
        }),
      ),
    );

    if (!catchUpPayment.ok) {
      results.push(
        resultFor(
          reservation,
          "failed",
          `Pembayaran awal tercatat, tetapi saldo belum lunas: ${catchUpPayment.error}`,
        ),
      );
      continue;
    }

    const finalFolio = await prisma.folio.findUnique({
      where: { id: updatedFolio.id },
      include: {
        lineItems: { include: { article: true } },
        payments: true,
      },
    });
    const finalBalance = finalFolio
      ? computeFolioTotals(finalFolio.lineItems, finalFolio.payments, settings)
          .balance
      : null;

    results.push(
      finalBalance !== null && Math.round(finalBalance) <= 0
        ? resultFor(reservation, "completed", "Saldo folio dilunasi.")
        : resultFor(
            reservation,
            "failed",
            "Pembayaran tercatat, tetapi saldo berubah sebelum pelunasan selesai.",
          ),
    );
  }

  revalidateGroup(groupBookingId);
  return { ok: true, results };
}

export async function checkoutEligibleGroupRooms(
  groupBookingId: string,
): Promise<GroupActionResult> {
  if (!(await canManageGroupCheckout())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsedGroupBookingId = GroupBookingIdSchema.safeParse(groupBookingId);
  if (!parsedGroupBookingId.success) {
    return { ok: false, error: "Booking grup tidak valid" };
  }

  const { today } = todayDateOnly();
  const [settings, reservations] = await Promise.all([
    prisma.hotelSettings.findUnique({ where: { id: 1 } }),
    prisma.reservation.findMany({
      where: { groupBookingId: parsedGroupBookingId.data },
      include: {
        room: { select: { number: true } },
        folio: {
          include: {
            lineItems: { include: { article: true } },
            payments: true,
          },
        },
      },
      orderBy: [{ room: { number: "asc" } }, { id: "asc" }],
    }),
  ]);

  if (!settings) {
    return { ok: false, error: "Hotel settings not found" };
  }

  const results: GroupRoomActionResult[] = [];

  // This loop only selects candidates. completeCheckout remains responsible for
  // its real balance gate and its transaction that closes the folio, checks out
  // the reservation, and changes the room to VD.
  for (const reservation of reservations) {
    if (reservation.status !== ReservationStatus.CHECKED_IN) {
      const reason =
        reservation.status === ReservationStatus.CHECKED_OUT
          ? "Sudah check-out."
          : reservation.status === ReservationStatus.CANCELLED
            ? "Reservasi dibatalkan."
            : reservation.status === ReservationStatus.NO_SHOW
              ? "Reservasi no-show."
              : "Belum check-in.";
      results.push(resultFor(reservation, "skipped", reason));
      continue;
    }

    if (!reservation.folio) {
      results.push(resultFor(reservation, "skipped", "Folio belum dibuat."));
      continue;
    }
    const folio = reservation.folio;

    if (folio.status !== FolioStatus.OPEN) {
      results.push(
        resultFor(
          reservation,
          "skipped",
          folio.status === FolioStatus.CLOSED
            ? "Folio sudah tertutup."
            : "Folio dibatalkan.",
        ),
      );
      continue;
    }

    const balance = computeFolioTotals(
      folio.lineItems,
      folio.payments,
      settings,
    ).balance;

    if (Math.round(balance) > 0) {
      results.push(
        resultFor(reservation, "skipped", "Belum lunas (settle dulu)."),
      );
      continue;
    }

    if (dateOnlyBoundary(reservation.departureDate).getTime() !== today.getTime()) {
      results.push(
        resultFor(
          reservation,
          "skipped",
          `Belum waktunya check-out (departure ${formatDateID(reservation.departureDate)}).`,
        ),
      );
      continue;
    }

    const checkout = await callExistingAction(() =>
      completeCheckout(
        actionFormData({
          folioId: String(folio.id),
          confirmed: "true",
        }),
      ),
    );

    results.push(
      checkout.ok
        ? resultFor(reservation, "completed", "Check-out selesai.")
        : resultFor(reservation, "failed", checkout.error),
    );
  }

  revalidateGroup(parsedGroupBookingId.data);
  return { ok: true, results };
}
