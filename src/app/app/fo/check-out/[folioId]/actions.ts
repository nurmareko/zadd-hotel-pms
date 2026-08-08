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
import { logActivity } from "@/lib/activity-log";
import { PaymentSchema } from "@/lib/folio/schema";
import { formatIDR } from "@/lib/format";
import { computeFolioTotals } from "@/lib/folio-totals";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import {
  postPendingStayCharges,
  StayChargePostingError,
} from "@/lib/stay-charges";

export type ActionResult = { ok: true } | { ok: false; error: string };

const CompleteCheckoutSchema = z.object({
  folioId: z.coerce.number().int().positive("Folio wajib dipilih"),
  confirmed: z.preprocess(
    (value) => value === "on" || value === "true" || value === true,
    z.literal(true, {
      error: "Konfirmasi wajib dicentang sebelum check-out",
    }),
  ),
});

class CheckoutActionError extends Error {}
class PaymentActionError extends Error {}

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

function validationError(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid check-out data";
}

async function canManageFoCheckout() {
  const session = await auth();

  if (session?.user.role !== "FO") {
    return null;
  }

  return Number(session.user.id);
}


export async function recordFinalPayment(
  formData: FormData,
): Promise<ActionResult> {
  const userId = await canManageFoCheckout();

  if (!userId) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = PaymentSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

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

  if (!folio) {
    return { ok: false, error: "Folio not found" };
  }

  if (!settings) {
    return { ok: false, error: "Hotel settings not found" };
  }

  if (folio.status !== FolioStatus.OPEN) {
    return { ok: false, error: "Cannot record payment on a closed folio" };
  }

  if (folio.reservation.status !== ReservationStatus.CHECKED_IN) {
    return {
      ok: false,
      error: "Reservation is not in checked-in state",
    };
  }

  // Post any room charges the night audit has not yet posted for the nights
  // already stayed, so the final payment can settle the true amount owed even
  // when check-out happens before the night audit runs.
  try {
    await postPendingStayCharges({ folioId: folio.id, postedById: userId });
  } catch (error) {
    if (error instanceof StayChargePostingError) {
      return { ok: false, error: error.message };
    }

    throw error;
  }

  const lineItems = await prisma.folioLineItem.findMany({
    where: { folioId: folio.id },
    include: { article: true },
  });

  const totals = computeFolioTotals(lineItems, folio.payments, settings);

  if (totals.balance <= 0) {
    return { ok: false, error: "Tagihan sudah lunas" };
  }

  if (parsed.data.amount > totals.balance) {
    return {
      ok: false,
      error: "Jumlah pembayaran melebihi saldo terbaru",
    };
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
            throw new PaymentActionError("Folio not found");
          }

          if (!currentSettings) {
            throw new PaymentActionError("Hotel settings not found");
          }

          if (currentFolio.status !== FolioStatus.OPEN) {
            throw new PaymentActionError(
              "Cannot record payment on a closed folio",
            );
          }

          if (
            currentFolio.reservation.status !== ReservationStatus.CHECKED_IN
          ) {
            throw new PaymentActionError(
              "Reservation is not in checked-in state",
            );
          }

          const currentTotals = computeFolioTotals(
            currentFolio.lineItems,
            currentFolio.payments,
            currentSettings,
          );

          if (currentTotals.balance <= 0) {
            throw new PaymentActionError("Tagihan sudah lunas");
          }

          if (parsed.data.amount > currentTotals.balance) {
            throw new PaymentActionError(
              "Jumlah pembayaran melebihi saldo terbaru",
            );
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
      paymentRecorded = true;
      break;
    } catch (error) {
      if (error instanceof PaymentActionError) {
        return { ok: false, error: error.message };
      }

      if (
        isPaymentSerializationConflict(error) &&
        attempt < MAX_PAYMENT_ATTEMPTS
      ) {
        continue;
      }

      if (isPaymentSerializationConflict(error)) {
        return {
          ok: false,
          error: "Konflik pembayaran berulang. Muat ulang dan coba lagi.",
        };
      }

      throw error;
    }
  }

  if (!paymentRecorded) {
    return {
      ok: false,
      error: "Konflik pembayaran berulang. Muat ulang dan coba lagi.",
    };
  }

  await logActivity({
    userId,
    action: "PAYMENT_RECORDED",
    folioId: folio.id,
    metadata: {
      amount: parsed.data.amount,
      method: parsed.data.method,
    },
  });

  revalidatePath(`/app/fo/check-out/${folio.id}`);
  revalidatePath(`/app/fo/folios/${folio.id}`);
  revalidatePath(`/app/fo/reservasi/${folio.reservationId}`);

  return { ok: true };
}

export async function completeCheckout(
  formData: FormData,
): Promise<ActionResult> {
  const userId = await canManageFoCheckout();

  if (!userId) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = CompleteCheckoutSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const [folio, settings] = await Promise.all([
    prisma.folio.findUnique({
      where: { id: parsed.data.folioId },
      include: {
        reservation: {
          include: {
            room: { select: { id: true, status: true } },
          },
        },
        lineItems: { include: { article: true } },
        payments: true,
      },
    }),
    prisma.hotelSettings.findUnique({ where: { id: 1 } }),
  ]);

  if (!folio) {
    return { ok: false, error: "Folio not found" };
  }

  if (!settings) {
    return { ok: false, error: "Hotel settings not found" };
  }

  if (folio.status === FolioStatus.CLOSED) {
    revalidatePath(`/app/fo/check-out/${parsed.data.folioId}`);
    revalidatePath(`/app/fo/folios/${parsed.data.folioId}`);
    revalidatePath(`/app/fo/reservasi/${folio.reservationId}`);
    revalidatePath("/app/fo/reservasi/kalender");
    revalidatePath("/app/fo/reservasi/list");
    revalidatePath("/app/hk");

    return { ok: true };
  }

  if (folio.status !== FolioStatus.OPEN) {
    return {
      ok: false,
      error: "Cannot check out a voided folio",
    };
  }

  if (folio.reservation.status !== ReservationStatus.CHECKED_IN) {
    return {
      ok: false,
      error: "Reservation is not in checked-in state",
    };
  }

  // Post any room charges the night audit has not yet posted for the nights
  // already stayed before judging the balance. Persisted up front (not inside
  // the close transaction) so a blocked check-out still surfaces the true
  // outstanding balance on the folio for staff to settle.
  try {
    await postPendingStayCharges({ folioId: folio.id, postedById: userId });
  } catch (error) {
    if (error instanceof StayChargePostingError) {
      return { ok: false, error: error.message };
    }

    throw error;
  }

  const lineItems = await prisma.folioLineItem.findMany({
    where: { folioId: folio.id },
    include: { article: true },
  });

  const totals = computeFolioTotals(lineItems, folio.payments, settings);

  if (totals.balance > 0) {
    revalidatePath(`/app/fo/check-out/${parsed.data.folioId}`);
    revalidatePath(`/app/fo/folios/${parsed.data.folioId}`);
    revalidatePath(`/app/fo/reservasi/${folio.reservationId}`);

    return {
      ok: false,
      error: `Saldo masih belum lunas (${formatIDR(
        totals.balance,
      )}). Catat pembayaran final dahulu.`,
    };
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
          throw new CheckoutActionError("Folio not found");
        }

        if (!currentSettings) {
          throw new CheckoutActionError("Hotel settings not found");
        }

        const currentTotals = computeFolioTotals(
          currentFolio.lineItems,
          currentFolio.payments,
          currentSettings,
        );

        if (currentTotals.balance > 0) {
          throw new CheckoutActionError(
            `Saldo masih belum lunas (${formatIDR(
              currentTotals.balance,
            )}). Catat pembayaran final dahulu.`,
          );
        }

        const closedFolio = await tx.folio.updateMany({
          where: { id: folio.id, status: FolioStatus.OPEN },
          data: {
            status: FolioStatus.CLOSED,
            closedAt: now,
          },
        });

        if (closedFolio.count === 0) {
          throw new CheckoutActionError(
            "Folio status changed. Muat ulang halaman.",
          );
        }

        const checkedOutReservation = await tx.reservation.updateMany({
          where: {
            id: folio.reservationId,
            status: ReservationStatus.CHECKED_IN,
          },
          data: { status: ReservationStatus.CHECKED_OUT },
        });

        if (checkedOutReservation.count === 0) {
          throw new CheckoutActionError(
            "Reservation is not in checked-in state",
          );
        }

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
      break;
    } catch (error) {
      if (error instanceof CheckoutActionError) {
        return { ok: false, error: error.message };
      }

      if (
        isCheckoutSerializationConflict(error) &&
        attempt < MAX_CHECKOUT_ATTEMPTS
      ) {
        continue;
      }

      if (isCheckoutSerializationConflict(error)) {
        return {
          ok: false,
          error: "Konflik check-out berulang. Muat ulang dan coba lagi.",
        };
      }

      throw error;
    }
  }

  if (!result) {
    return {
      ok: false,
      error: "Konflik check-out berulang. Muat ulang dan coba lagi.",
    };
  }

  if (!result.ok) {
    return result;
  }

  await logActivity({
    userId,
    action: "CHECK_OUT_COMPLETED",
    reservationId: folio.reservationId,
    folioId: folio.id,
    roomId: folio.reservation.roomId,
  });

  revalidatePath(`/app/fo/check-out/${parsed.data.folioId}`);
  revalidatePath(`/app/fo/folios/${parsed.data.folioId}`);
  revalidatePath(`/app/fo/reservasi/${folio.reservationId}`);
  revalidatePath("/app/fo/reservasi/kalender");
  revalidatePath("/app/fo/reservasi/list");
  revalidatePath("/app/hk");

  return { ok: true };
}
