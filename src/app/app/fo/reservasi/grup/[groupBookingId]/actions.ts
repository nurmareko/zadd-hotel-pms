"use server";

import { FolioStatus, PaymentMethod, ReservationStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { dateOnlyBoundary, todayDateOnly } from "@/lib/date-only";
import { formatDateID } from "@/lib/format";
import { computeFolioTotals } from "@/lib/folio-totals";
import { prisma } from "@/lib/prisma";
import {
  completeCheckout,
  recordFinalPayment,
} from "../../../check-out/[folioId]/actions";

const GroupBookingIdSchema = z.string().trim().min(1, "Booking grup tidak valid");

const SettleGroupBalancesSchema = z
  .object({
    groupBookingId: GroupBookingIdSchema,
    method: z.enum(PaymentMethod),
    reference: z.string().trim().max(100).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.method === PaymentMethod.TRANSFER && !value.reference) {
      ctx.addIssue({
        code: "custom",
        path: ["reference"],
        message: "Referensi wajib diisi untuk pembayaran transfer",
      });
    }
  });

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
  revalidatePath(`/app/fo/reservasi/grup/${groupBookingId}`);
  revalidatePath("/app/fo/reservasi/list");
}

function unexpectedActionError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Terjadi kegagalan saat memproses kamar ini.";
}

async function callExistingAction(
  action: () => Promise<DelegatedActionResult>,
): Promise<DelegatedActionResult> {
  try {
    return await action();
  } catch (error) {
    return { ok: false, error: unexpectedActionError(error) };
  }
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
