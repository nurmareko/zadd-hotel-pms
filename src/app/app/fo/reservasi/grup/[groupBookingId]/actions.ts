"use server";

import {
  DepositStatus,
  FolioStatus,
  PaymentMethod,
  PaymentPurpose,
  ReservationStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import {
  checkActionAuthorization,
  logActionFailure,
  rethrowFrameworkErrors,
} from "@/lib/action-errors";
import {
  CHECK_IN_FAILURE_MESSAGES,
  CHECK_IN_UNKNOWN_RESULT_MESSAGES,
} from "@/lib/check-in/errors";
import { dateOnlyBoundary, todayDateOnly } from "@/lib/date-only";
import { formatDateID, formatIDR } from "@/lib/format";
import { computeFolioTotals } from "@/lib/folio-totals";
import { prisma } from "@/lib/prisma";
import { collectCheckInDepositForGroup } from "@/lib/check-in/actions";
import { checkInDepositMethods } from "@/lib/check-in/schema";
import {
  completeCheckout,
  recordFinalPayment,
} from "../../../check-out/[folioId]/actions";
import {
  checkoutAuthorizationFailure,
  checkoutFailure,
  type CheckoutActionResult,
  type CheckoutFailureCode,
} from "../../../check-out/[folioId]/errors";

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

type GroupActionStatus = "completed" | "skipped" | "failed" | "uncertain";

export type GroupActionDetail = {
  label: string;
  status: GroupActionStatus;
  reason: string;
};

export type GroupRoomActionResult = {
  reservationId: number;
  reservationNo: string;
  roomNumber: string | null;
  status: GroupActionStatus;
  reason: string;
  code?: CheckoutFailureCode;
  details?: GroupActionDetail[];
};

export type GroupActionResult =
  | { ok: true; results: GroupRoomActionResult[] }
  | { ok: false; error: string; code?: CheckoutFailureCode };

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
  code?: CheckoutFailureCode,
  details?: GroupActionDetail[],
): GroupRoomActionResult {
  return {
    reservationId: reservation.id,
    reservationNo: reservation.reservationNo,
    roomNumber: roomLabel(reservation.room),
    status,
    reason,
    ...(code ? { code } : {}),
    ...(details ? { details } : {}),
  };
}

const SETTLEMENT_STATUS_UNCERTAIN_MESSAGE =
  "Pembayaran berhasil dicatat, tetapi status pelunasan akhir belum dapat dipastikan. Muat ulang halaman sebelum melakukan pembayaran atau check-out lagi.";

function completedPaymentDetail(label: string, amount: number): GroupActionDetail {
  return {
    label,
    status: "completed",
    reason: `Pembayaran ${formatIDR(amount)} berhasil dicatat.`,
  };
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

async function callExistingCheckoutAction(
  action: () => Promise<CheckoutActionResult>,
  context: { action: string; reservationId: number },
): Promise<CheckoutActionResult> {
  try {
    return await action();
  } catch (error) {
    rethrowFrameworkErrors(error);
    logActionFailure("groupCheckout:sibling", error, {
      ...context,
      stage: "delegated-action",
    });
    return checkoutFailure("RESULT_UNKNOWN");
  }
}

export async function collectGroupDeposits(input: {
  groupBookingId: string;
  method: PaymentMethod;
  reference?: string;
}): Promise<GroupActionResult> {
  const session = await auth();
  const authFailure = checkActionAuthorization(session, ["FO"]);
  if (authFailure) {
    return { ok: false, error: authFailure.error };
  }

  const parsed = GroupDepositSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: CHECK_IN_FAILURE_MESSAGES.INVALID_INPUT,
    };
  }

  const { groupBookingId, method, reference } = parsed.data;
  const { today } = todayDateOnly();
  let reservations;
  try {
    reservations = await prisma.reservation.findMany({
      where: { groupBookingId },
      include: {
        room: { select: { number: true } },
        folio: {
          select: {
            payments: {
              where: { purpose: PaymentPurpose.DEPOSIT },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
      orderBy: [{ room: { number: "asc" } }, { id: "asc" }],
    });
  } catch (error) {
    rethrowFrameworkErrors(error);
    logActionFailure("collectGroupDeposits", error, {
      action: "collectGroupDeposits",
      stage: "query",
      groupBookingId,
    });
    return {
      ok: false,
      error: CHECK_IN_FAILURE_MESSAGES.REVIEW_UNEXPECTED,
    };
  }

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

    if (
      reservation.depositStatus === DepositStatus.COLLECTED &&
      reservation.folio?.payments.length
    ) {
      results.push(resultFor(reservation, "skipped", "Deposit sudah dikumpulkan."));
      continue;
    }

    if (
      reservation.depositStatus === DepositStatus.PENDING &&
      dateOnlyBoundary(reservation.arrivalDate) > today
    ) {
      results.push(
        resultFor(
          reservation,
          "skipped",
          `Belum waktunya mengumpulkan deposit (arrival ${formatDateID(reservation.arrivalDate)}).`,
        ),
      );
      continue;
    }

    let deposit: Awaited<ReturnType<typeof collectCheckInDepositForGroup>>;
    try {
      deposit = await collectCheckInDepositForGroup({
        reservationId: reservation.id,
        depositMethod: method,
        depositReference: reference,
        groupBookingId,
      });
    } catch (error) {
      rethrowFrameworkErrors(error);
      logActionFailure("collectGroupDeposits:sibling", error, {
        action: "collectGroupDeposits",
        stage: "sibling",
        reservationId: reservation.id,
      });
      deposit = {
        ok: false,
        code: "RESULT_UNKNOWN",
        error: CHECK_IN_UNKNOWN_RESULT_MESSAGES.deposit,
      };
    }

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
  const session = await auth();
  const authFailure = checkoutAuthorizationFailure(session);
  if (authFailure) return authFailure;

  const parsed = SettleGroupBalancesSchema.safeParse(input);
  if (!parsed.success) return checkoutFailure("INVALID_INPUT");

  const { groupBookingId, method, reference } = parsed.data;
  let settings;
  let reservations;
  try {
    [settings, reservations] = await Promise.all([
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
  } catch (error) {
    rethrowFrameworkErrors(error);
    logActionFailure("settleGroupBalances", error, {
      action: "settleGroupBalances",
      stage: "query",
    });
    return checkoutFailure("FINAL_PAYMENT_UNEXPECTED");
  }

  if (!settings) return checkoutFailure("SETTINGS_UNAVAILABLE");

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

    const payment = await callExistingCheckoutAction(
      () =>
        recordFinalPayment(
          actionFormData({
            folioId: String(folio.id),
            amount: String(balance),
            method,
            ...(reference ? { reference } : {}),
          }),
        ),
      { action: "settleGroupBalances", reservationId: reservation.id },
    );

    if (!payment.ok) {
      results.push(
        resultFor(
          reservation,
          payment.code === "RESULT_UNKNOWN" ? "uncertain" : "failed",
          payment.error,
          payment.code,
        ),
      );
      continue;
    }

    const confirmedPayments = [
      completedPaymentDetail("Pembayaran awal", balance),
    ];

    // recordFinalPayment can post a stay-charge shortfall before creating its
    // payment. Re-read its result rather than reproducing that calculation;
    // a second call uses the same authoritative payment path only when that
    // newly posted charge left a balance behind.
    let updatedFolio;
    try {
      updatedFolio = await prisma.folio.findUnique({
        where: { id: folio.id },
        include: {
          lineItems: { include: { article: true } },
          payments: true,
        },
      });
    } catch (error) {
      rethrowFrameworkErrors(error);
      logActionFailure("settleGroupBalances:sibling", error, {
        action: "settleGroupBalances",
        stage: "post-payment-read",
        reservationId: reservation.id,
        committed: true,
      });
      results.push(
        resultFor(
          reservation,
          "uncertain",
          SETTLEMENT_STATUS_UNCERTAIN_MESSAGE,
          "RESULT_UNKNOWN",
          confirmedPayments,
        ),
      );
      continue;
    }

    if (!updatedFolio) {
      results.push(
        resultFor(
          reservation,
          "uncertain",
          SETTLEMENT_STATUS_UNCERTAIN_MESSAGE,
          "RESULT_UNKNOWN",
          confirmedPayments,
        ),
      );
      continue;
    }

    const remainingBalance = computeFolioTotals(
      updatedFolio.lineItems,
      updatedFolio.payments,
      settings,
    ).balance;

    if (Math.round(remainingBalance) <= 0) {
      results.push(
        resultFor(
          reservation,
          "completed",
          "Saldo folio dilunasi.",
          undefined,
          confirmedPayments,
        ),
      );
      continue;
    }

    const catchUpPayment = await callExistingCheckoutAction(
      () =>
        recordFinalPayment(
          actionFormData({
            folioId: String(updatedFolio.id),
            amount: String(remainingBalance),
            method,
            ...(reference ? { reference } : {}),
          }),
        ),
      { action: "settleGroupBalances:catchUp", reservationId: reservation.id },
    );

    if (!catchUpPayment.ok) {
      results.push(
        resultFor(
          reservation,
          catchUpPayment.code === "RESULT_UNKNOWN" ? "uncertain" : "failed",
          catchUpPayment.code === "RESULT_UNKNOWN"
            ? `Pembayaran awal tercatat. ${catchUpPayment.error}`
            : `Pembayaran awal tercatat, tetapi saldo belum lunas: ${catchUpPayment.error}`,
          catchUpPayment.code,
          [
            ...confirmedPayments,
            {
              label: "Pembayaran tambahan",
              status:
                catchUpPayment.code === "RESULT_UNKNOWN" ? "uncertain" : "failed",
              reason: catchUpPayment.error,
            },
          ],
        ),
      );
      continue;
    }

    confirmedPayments.push(
      completedPaymentDetail("Pembayaran tambahan", remainingBalance),
    );

    let finalFolio;
    try {
      finalFolio = await prisma.folio.findUnique({
        where: { id: updatedFolio.id },
        include: {
          lineItems: { include: { article: true } },
          payments: true,
        },
      });
    } catch (error) {
      rethrowFrameworkErrors(error);
      logActionFailure("settleGroupBalances:sibling", error, {
        action: "settleGroupBalances",
        stage: "final-read",
        reservationId: reservation.id,
        committed: true,
      });
      results.push(
        resultFor(
          reservation,
          "uncertain",
          SETTLEMENT_STATUS_UNCERTAIN_MESSAGE,
          "RESULT_UNKNOWN",
          confirmedPayments,
        ),
      );
      continue;
    }
    const finalBalance = finalFolio
      ? computeFolioTotals(finalFolio.lineItems, finalFolio.payments, settings)
          .balance
      : null;

    results.push(
      finalBalance === null
        ? resultFor(
            reservation,
            "uncertain",
            SETTLEMENT_STATUS_UNCERTAIN_MESSAGE,
            "RESULT_UNKNOWN",
            confirmedPayments,
          )
        : Math.round(finalBalance) <= 0
          ? resultFor(
              reservation,
              "completed",
              "Saldo folio dilunasi.",
              undefined,
              confirmedPayments,
            )
          : resultFor(
              reservation,
              "failed",
              `Pembayaran tercatat, tetapi Sisa Tagihan masih ${formatIDR(finalBalance)}. Muat ulang halaman sebelum melakukan pembayaran atau check-out lagi.`,
              undefined,
              confirmedPayments,
            ),
    );
  }

  revalidateGroup(groupBookingId);
  return { ok: true, results };
}

export async function checkoutEligibleGroupRooms(
  groupBookingId: string,
): Promise<GroupActionResult> {
  const session = await auth();
  const authFailure = checkoutAuthorizationFailure(session);
  if (authFailure) return authFailure;

  const parsedGroupBookingId = GroupBookingIdSchema.safeParse(groupBookingId);
  if (!parsedGroupBookingId.success) return checkoutFailure("INVALID_INPUT");

  const { today } = todayDateOnly();
  let settings;
  let reservations;
  try {
    [settings, reservations] = await Promise.all([
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
  } catch (error) {
    rethrowFrameworkErrors(error);
    logActionFailure("checkoutEligibleGroupRooms", error, {
      action: "checkoutEligibleGroupRooms",
      stage: "query",
    });
    return checkoutFailure("CHECKOUT_UNEXPECTED");
  }

  if (!settings) return checkoutFailure("SETTINGS_UNAVAILABLE");

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

    const checkout = await callExistingCheckoutAction(
      () =>
        completeCheckout(
          actionFormData({
            folioId: String(folio.id),
            confirmed: "true",
          }),
        ),
      { action: "checkoutEligibleGroupRooms", reservationId: reservation.id },
    );

    results.push(
      checkout.ok
        ? resultFor(reservation, "completed", "Check-out selesai.")
        : resultFor(
            reservation,
            checkout.code === "RESULT_UNKNOWN" ? "uncertain" : "failed",
            checkout.error,
            checkout.code,
          ),
    );
  }

  revalidateGroup(parsedGroupBookingId.data);
  return { ok: true, results };
}
