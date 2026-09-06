"use server";

import {
  FolioStatus,
  PaymentPurpose,
  Prisma,
  ReservationStatus,
  RoomStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import {
  logActionFailure,
  rethrowFrameworkErrors,
  runPostCommitSideEffects,
} from "@/lib/action-errors";
import { logActivity } from "@/lib/activity-log";
import { PaymentSchema } from "@/lib/folio/schema";
import { formatIDR } from "@/lib/format";
import { computeFolioTotals } from "@/lib/folio-totals";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import {
  postPendingStayCharges,
  StayChargePostingError,
} from "@/lib/stay-charges";
import {
  checkoutAuthorizationFailure,
  checkoutFailure,
  checkoutStayChargeFailure,
  checkoutValidationFailure,
  type CheckoutActionResult,
  type CheckoutFailureCode,
} from "./errors";

export type ActionResult = CheckoutActionResult;

const CompleteCheckoutSchema = z.object({
  folioId: z.coerce.number().int().positive("Folio wajib dipilih"),
  confirmed: z.preprocess(
    (value) => value === "on" || value === "true" || value === true,
    z.literal(true, {
      error: "Konfirmasi wajib dicentang sebelum check-out",
    }),
  ),
});

class CheckoutActionError extends Error {
  constructor(
    public readonly code: CheckoutFailureCode,
    public readonly amount?: string,
  ) {
    super(code);
  }
}

class PaymentActionError extends Error {
  constructor(public readonly code: CheckoutFailureCode) {
    super(code);
  }
}

const MAX_CHECKOUT_ATTEMPTS = 3;
const MAX_PAYMENT_ATTEMPTS = 3;

function isCheckoutSerializationConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

function isPaymentSerializationConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

function finalPaymentRevalidationEffects(
  folioId: number,
  reservationId: number,
) {
  return [
    {
      name: "revalidate checkout",
      run: () => revalidatePath(`/app/fo/check-out/${folioId}`),
    },
    {
      name: "revalidate folio",
      run: () => revalidatePath(`/app/fo/folios/${folioId}`),
    },
    {
      name: "revalidate reservation",
      run: () => revalidatePath(`/app/fo/reservasi/${reservationId}`),
    },
  ];
}

function checkoutRevalidationEffects(folioId: number, reservationId: number) {
  return [
    ...finalPaymentRevalidationEffects(folioId, reservationId),
    {
      name: "revalidate reservation calendar",
      run: () => revalidatePath("/app/fo/reservasi/kalender"),
    },
    {
      name: "revalidate reservation list",
      run: () => revalidatePath("/app/fo/reservasi/list"),
    },
    { name: "revalidate housekeeping", run: () => revalidatePath("/app/hk") },
  ];
}

export async function recordFinalPayment(
  formData: FormData,
): Promise<ActionResult> {
  let stayChargePostingCompleted = false;

  try {
    const session = await auth();
    const authFailure = checkoutAuthorizationFailure(session);
    if (authFailure) return authFailure;
    const userId = Number(session!.user!.id);

    const parsed = PaymentSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return checkoutValidationFailure(parsed.error);

    const [folio, settings] = await Promise.all([
      prisma.folio.findUnique({
        where: { id: parsed.data.folioId },
        include: {
          reservation: { select: { status: true } },
          lineItems: { include: { article: true } },
          payments: true,
        },
      }),
      prisma.hotelSettings.findUnique({ where: { id: 1 } }),
    ]);

    if (!folio) return checkoutFailure("FOLIO_NOT_FOUND");
    if (!settings) return checkoutFailure("SETTINGS_UNAVAILABLE");
    if (folio.status !== FolioStatus.OPEN) {
      return checkoutFailure("FOLIO_NOT_OPEN");
    }
    if (folio.reservation.status !== ReservationStatus.CHECKED_IN) {
      return checkoutFailure("RESERVATION_NOT_CHECKED_IN");
    }

    // This remains the existing separate canonical stay-charge transaction.
    try {
      await postPendingStayCharges({ folioId: folio.id, postedById: userId });
      stayChargePostingCompleted = true;
    } catch (error) {
      if (error instanceof StayChargePostingError) {
        return checkoutStayChargeFailure(error, {
          action: "recordFinalPayment",
          stage: "stay-charge-posting",
        });
      }
      throw error;
    }

    const lineItems = await prisma.folioLineItem.findMany({
      where: { folioId: folio.id },
      include: { article: true },
    });
    const totals = computeFolioTotals(lineItems, folio.payments, settings);

    if (totals.balance <= 0) {
      return checkoutFailure("BALANCE_ALREADY_SETTLED");
    }
    if (parsed.data.amount > totals.balance) {
      return checkoutFailure("PAYMENT_EXCEEDS_BALANCE");
    }

    let paymentRecorded = false;

    for (let attempt = 1; attempt <= MAX_PAYMENT_ATTEMPTS; attempt += 1) {
      try {
        await prisma.$transaction(
          async (tx) => {
            const currentFolio = await tx.folio.findUnique({
              where: { id: folio.id },
              include: {
                reservation: { select: { status: true } },
                lineItems: { include: { article: true } },
                payments: true,
              },
            });
            const currentSettings = await tx.hotelSettings.findUnique({
              where: { id: 1 },
            });

            if (!currentFolio) {
              throw new PaymentActionError("FOLIO_NOT_FOUND");
            }
            if (!currentSettings) {
              throw new PaymentActionError("SETTINGS_UNAVAILABLE");
            }
            if (currentFolio.status !== FolioStatus.OPEN) {
              throw new PaymentActionError("FOLIO_CHANGED");
            }
            if (
              currentFolio.reservation.status !== ReservationStatus.CHECKED_IN
            ) {
              throw new PaymentActionError("RESERVATION_NOT_CHECKED_IN");
            }

            const currentTotals = computeFolioTotals(
              currentFolio.lineItems,
              currentFolio.payments,
              currentSettings,
            );

            if (currentTotals.balance <= 0) {
              throw new PaymentActionError("BALANCE_ALREADY_SETTLED");
            }
            if (parsed.data.amount > currentTotals.balance) {
              throw new PaymentActionError("PAYMENT_EXCEEDS_BALANCE");
            }

            await tx.payment.create({
              data: {
                folioId: currentFolio.id,
                fbOrderId: null,
                amount: parsed.data.amount,
                method: parsed.data.method,
                purpose:
                  parsed.data.amount === currentTotals.balance
                    ? PaymentPurpose.SETTLEMENT
                    : PaymentPurpose.PAYMENT,
                reference: parsed.data.reference || null,
                receivedById: userId,
                receivedAt: new Date(),
              },
            });
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            ...TRANSACTION_OPTIONS,
          },
        );
        // Commit boundary: the authoritative payment transaction resolved.
        paymentRecorded = true;
        break;
      } catch (error) {
        if (error instanceof PaymentActionError) {
          return checkoutFailure(error.code);
        }
        if (
          isPaymentSerializationConflict(error) &&
          attempt < MAX_PAYMENT_ATTEMPTS
        ) {
          continue;
        }
        if (isPaymentSerializationConflict(error)) {
          return checkoutFailure("PAYMENT_CONFLICT");
        }
        throw error;
      }
    }

    if (!paymentRecorded) return checkoutFailure("PAYMENT_CONFLICT");

    await runPostCommitSideEffects(
      [
        {
          name: "record final-payment activity",
          run: () =>
            logActivity({
              userId,
              action: "PAYMENT_RECORDED",
              folioId: folio.id,
              metadata: {
                amount: parsed.data.amount,
                method: parsed.data.method,
              },
            }),
        },
        ...finalPaymentRevalidationEffects(folio.id, folio.reservationId),
      ],
      { action: "recordFinalPayment", committed: true },
    );

    return { ok: true };
  } catch (error) {
    rethrowFrameworkErrors(error);
    logActionFailure("recordFinalPayment", error, {
      action: "recordFinalPayment",
      stage: "before-payment-commit",
      paymentCommitted: false,
      stayChargePostingCompleted,
    });
    return checkoutFailure("FINAL_PAYMENT_UNEXPECTED");
  }
}

export async function completeCheckout(
  formData: FormData,
): Promise<ActionResult> {
  let stayChargePostingCompleted = false;

  try {
    const session = await auth();
    const authFailure = checkoutAuthorizationFailure(session);
    if (authFailure) return authFailure;
    const userId = Number(session!.user!.id);

    const parsed = CompleteCheckoutSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return checkoutValidationFailure(parsed.error);

    const [folio, settings] = await Promise.all([
      prisma.folio.findUnique({
        where: { id: parsed.data.folioId },
        include: {
          reservation: {
            include: { room: { select: { id: true, status: true } } },
          },
          lineItems: { include: { article: true } },
          payments: true,
        },
      }),
      prisma.hotelSettings.findUnique({ where: { id: 1 } }),
    ]);

    if (!folio) return checkoutFailure("FOLIO_NOT_FOUND");
    if (!settings) return checkoutFailure("SETTINGS_UNAVAILABLE");

    if (folio.status === FolioStatus.CLOSED) {
      await runPostCommitSideEffects(
        checkoutRevalidationEffects(parsed.data.folioId, folio.reservationId),
        { action: "completeCheckout", stage: "already-closed", committed: true },
      );
      return { ok: true };
    }
    if (folio.status !== FolioStatus.OPEN) {
      return checkoutFailure("FOLIO_VOIDED");
    }
    if (folio.reservation.status !== ReservationStatus.CHECKED_IN) {
      return checkoutFailure("RESERVATION_NOT_CHECKED_IN");
    }

    // This remains the existing separate canonical stay-charge transaction.
    try {
      await postPendingStayCharges({ folioId: folio.id, postedById: userId });
      stayChargePostingCompleted = true;
    } catch (error) {
      if (error instanceof StayChargePostingError) {
        return checkoutStayChargeFailure(error, {
          action: "completeCheckout",
          stage: "stay-charge-posting",
        });
      }
      throw error;
    }

    const lineItems = await prisma.folioLineItem.findMany({
      where: { folioId: folio.id },
      include: { article: true },
    });
    const totals = computeFolioTotals(lineItems, folio.payments, settings);

    if (totals.balance > 0) {
      await runPostCommitSideEffects(
        finalPaymentRevalidationEffects(
          parsed.data.folioId,
          folio.reservationId,
        ),
        {
          action: "completeCheckout",
          stage: "balance-blocked-after-stay-posting",
          checkoutCommitted: false,
          stayChargePostingCompleted,
        },
      );
      return checkoutFailure("BALANCE_DUE", {
        amount: formatIDR(totals.balance),
      });
    }

    const now = new Date();
    let result: ActionResult | null = null;

    for (let attempt = 1; attempt <= MAX_CHECKOUT_ATTEMPTS; attempt += 1) {
      try {
        result = await prisma.$transaction(
          async (tx) => {
            const currentFolio = await tx.folio.findUnique({
              where: { id: folio.id },
              include: {
                lineItems: { include: { article: true } },
                payments: true,
              },
            });
            const currentSettings = await tx.hotelSettings.findUnique({
              where: { id: 1 },
            });

            if (!currentFolio) {
              throw new CheckoutActionError("FOLIO_NOT_FOUND");
            }
            if (!currentSettings) {
              throw new CheckoutActionError("SETTINGS_UNAVAILABLE");
            }

            const currentTotals = computeFolioTotals(
              currentFolio.lineItems,
              currentFolio.payments,
              currentSettings,
            );
            if (currentTotals.balance > 0) {
              throw new CheckoutActionError(
                "BALANCE_DUE",
                formatIDR(currentTotals.balance),
              );
            }

            const closedFolio = await tx.folio.updateMany({
              where: { id: folio.id, status: FolioStatus.OPEN },
              data: { status: FolioStatus.CLOSED, closedAt: now },
            });
            if (closedFolio.count === 0) {
              throw new CheckoutActionError("FOLIO_CHANGED");
            }

            const checkedOutReservation = await tx.reservation.updateMany({
              where: {
                id: folio.reservationId,
                status: ReservationStatus.CHECKED_IN,
              },
              data: { status: ReservationStatus.CHECKED_OUT },
            });
            if (checkedOutReservation.count === 0) {
              throw new CheckoutActionError("RESERVATION_NOT_CHECKED_IN");
            }

            // Preserve the existing advisory room ID behavior for this batch.
            if (folio.reservation.roomId) {
              await tx.room.update({
                where: { id: folio.reservation.roomId },
                data: { status: RoomStatus.VD },
              });
            }

            return { ok: true as const };
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            ...TRANSACTION_OPTIONS,
          },
        );
        // Commit boundary: the atomic folio/reservation/room close transaction resolved.
        break;
      } catch (error) {
        if (error instanceof CheckoutActionError) {
          return checkoutFailure(error.code, { amount: error.amount });
        }
        if (
          isCheckoutSerializationConflict(error) &&
          attempt < MAX_CHECKOUT_ATTEMPTS
        ) {
          continue;
        }
        if (isCheckoutSerializationConflict(error)) {
          return checkoutFailure("CHECKOUT_CONFLICT");
        }
        throw error;
      }
    }

    if (!result) return checkoutFailure("CHECKOUT_CONFLICT");
    if (!result.ok) return result;

    await runPostCommitSideEffects(
      [
        {
          name: "record checkout activity",
          run: () =>
            logActivity({
              userId,
              action: "CHECK_OUT_COMPLETED",
              reservationId: folio.reservationId,
              folioId: folio.id,
              roomId: folio.reservation.roomId,
            }),
        },
        ...checkoutRevalidationEffects(
          parsed.data.folioId,
          folio.reservationId,
        ),
      ],
      { action: "completeCheckout", committed: true },
    );

    return { ok: true };
  } catch (error) {
    rethrowFrameworkErrors(error);
    logActionFailure("completeCheckout", error, {
      action: "completeCheckout",
      stage: "before-checkout-commit",
      checkoutCommitted: false,
      stayChargePostingCompleted,
    });
    return checkoutFailure("CHECKOUT_UNEXPECTED");
  }
}
