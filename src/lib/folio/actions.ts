"use server";

import { ArticleType, FolioStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { logActivity } from "@/lib/activity-log";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { STAY_FEE_ARTICLE_CODES } from "@/lib/reservation-stay-fee-definitions";
import { STAY_CHARGE_ARTICLE_CODES } from "@/lib/stay-charges";
import { PaymentSchema, PostChargeSchema } from "./schema";

export type ActionResult = { ok: true } | { ok: false; error: string };

class ChargeActionError extends Error {}
class PaymentActionError extends Error {}

const MAX_CHARGE_ATTEMPTS = 3;
const MAX_PAYMENT_ATTEMPTS = 3;

function isChargeSerializationConflict(error: unknown) {
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
  return error.issues[0]?.message ?? "Invalid folio data";
}

async function canManageFoFolio() {
  const session = await auth();

  if (session?.user.role !== "FO") {
    return null;
  }

  return Number(session.user.id);
}

export async function postCharge(
  formData: FormData,
): Promise<ActionResult> {
  const userId = await canManageFoFolio();

  if (!userId) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = PostChargeSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const folio = await prisma.folio.findUnique({
    where: { id: parsed.data.folioId },
    select: { id: true, reservationId: true, status: true },
  });

  if (!folio) {
    return { ok: false, error: "Folio not found" };
  }

  if (folio.status !== FolioStatus.OPEN) {
    return {
      ok: false,
      error: "Tidak dapat memposting charge ke folio yang sudah ditutup",
    };
  }

  const article = await prisma.article.findUnique({
    where: { id: parsed.data.articleId },
    select: { id: true, code: true, name: true, type: true },
  });

  if (!article) {
    return { ok: false, error: "Article not found" };
  }

  if (article.type === ArticleType.TAX) {
    return { ok: false, error: "Tax is computed automatically" };
  }

  if (
    STAY_CHARGE_ARTICLE_CODES.some((code) => code === article.code) ||
    STAY_FEE_ARTICLE_CODES.some((code) => code === article.code)
  ) {
    return { ok: false, error: "Biaya menginap diposting secara otomatis" };
  }

  const description = parsed.data.description?.trim() || article.name;
  const amount = new Prisma.Decimal(parsed.data.quantity).mul(
    parsed.data.unitPrice,
  );

  let chargePosted = false;

  for (let attempt = 1; attempt <= MAX_CHARGE_ATTEMPTS; attempt += 1) {
    try {
      await prisma.$transaction(
        async (tx) => {
          const currentFolio = await tx.folio.findUnique({
            where: { id: folio.id },
            select: { id: true, status: true },
          });

          if (!currentFolio) {
            throw new ChargeActionError("Folio not found");
          }

          if (currentFolio.status !== FolioStatus.OPEN) {
            throw new ChargeActionError(
              "Tidak dapat memposting charge ke folio yang sudah ditutup",
            );
          }

          await tx.folioLineItem.create({
            data: {
              articleId: article.id,
              folioId: currentFolio.id,
              description,
              quantity: parsed.data.quantity,
              unitPrice: parsed.data.unitPrice,
              amount,
              postedById: userId,
              postedAt: new Date(),
            },
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          ...TRANSACTION_OPTIONS,
        },
      );
      chargePosted = true;
      break;
    } catch (error) {
      if (error instanceof ChargeActionError) {
        return { ok: false, error: error.message };
      }

      if (
        isChargeSerializationConflict(error) &&
        attempt < MAX_CHARGE_ATTEMPTS
      ) {
        continue;
      }

      if (isChargeSerializationConflict(error)) {
        return {
          ok: false,
          error: "Konflik posting charge berulang. Muat ulang dan coba lagi.",
        };
      }

      throw error;
    }
  }

  if (!chargePosted) {
    return {
      ok: false,
      error: "Konflik posting charge berulang. Muat ulang dan coba lagi.",
    };
  }

  await logActivity({
    userId,
    action: "FOLIO_CHARGE_POSTED",
    folioId: folio.id,
    metadata: { amount: amount.toNumber() },
  });

  revalidatePath(`/app/fo/folios/${folio.id}`);
  revalidatePath(`/app/fo/reservasi/${folio.reservationId}`);

  return { ok: true };
}

export async function recordPayment(
  formData: FormData,
): Promise<ActionResult> {
  const userId = await canManageFoFolio();

  if (!userId) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = PaymentSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const folio = await prisma.folio.findUnique({
    where: { id: parsed.data.folioId },
    select: { id: true, reservationId: true, status: true },
  });

  if (!folio) {
    return { ok: false, error: "Folio not found" };
  }

  if (folio.status !== FolioStatus.OPEN) {
    return { ok: false, error: "Cannot record payment on a closed folio" };
  }

  let paymentRecorded = false;

  for (let attempt = 1; attempt <= MAX_PAYMENT_ATTEMPTS; attempt += 1) {
    try {
      await prisma.$transaction(
        async (tx) => {
          const currentFolio = await tx.folio.findUnique({
            where: { id: folio.id },
            select: { id: true, status: true },
          });

          if (!currentFolio) {
            throw new PaymentActionError("Folio not found");
          }

          if (currentFolio.status !== FolioStatus.OPEN) {
            throw new PaymentActionError(
              "Cannot record payment on a closed folio",
            );
          }

          await tx.payment.create({
            data: {
              folioId: currentFolio.id,
              fbOrderId: null,
              amount: parsed.data.amount,
              method: parsed.data.method,
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

  revalidatePath(`/app/fo/folios/${folio.id}`);
  revalidatePath(`/app/fo/reservasi/${folio.reservationId}`);

  return { ok: true };
}
