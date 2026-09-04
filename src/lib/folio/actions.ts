"use server";

import { ArticleType, FolioStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { auth } from "@/auth";
import {
  checkActionAuthorization,
  logActionFailure,
  runPostCommitSideEffects,
} from "@/lib/action-errors";
import { logActivity } from "@/lib/activity-log";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { STAY_FEE_ARTICLE_CODES } from "@/lib/reservation-stay-fee-definitions";
import { STAY_CHARGE_ARTICLE_CODES } from "@/lib/stay-charges";
import {
  folioFailure,
  type FolioActionResult,
  type FolioFailure,
  type FolioFailureCode,
} from "./errors";
import { PaymentSchema, PostChargeSchema } from "./schema";

export type ActionResult = FolioActionResult;

class ChargeDomainError extends Error {
  constructor(readonly code: FolioFailureCode) {
    super(code);
  }
}

class PaymentDomainError extends Error {
  constructor(readonly code: FolioFailureCode) {
    super(code);
  }
}

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

async function canManageFoFolio(): Promise<
  { ok: true; userId: number } | FolioFailure
> {
  const session = await auth();

  const authFailure = checkActionAuthorization(session, ["FO"]);
  if (authFailure) {
    return folioFailure(authFailure.code as FolioFailureCode);
  }

  const userId = Number(session?.user?.id);
  if (!Number.isFinite(userId) || userId <= 0) {
    return folioFailure("SESSION_EXPIRED");
  }

  return { ok: true, userId };
}

export async function postCharge(
  formData: FormData,
): Promise<FolioActionResult> {
  let folioIdForLog: number | undefined;
  let articleIdForLog: number | undefined;

  try {
    const authResult = await canManageFoFolio();
    if (!authResult.ok) {
      return authResult;
    }

    const parsed = PostChargeSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return folioFailure("INVALID_INPUT");
    }

    folioIdForLog = parsed.data.folioId;
    articleIdForLog = parsed.data.articleId;

    const folio = await prisma.folio.findUnique({
      where: { id: parsed.data.folioId },
      select: { id: true, reservationId: true, status: true },
    });

    if (!folio) {
      return folioFailure("FOLIO_NOT_FOUND");
    }

    if (folio.status !== FolioStatus.OPEN) {
      return folioFailure("FOLIO_NOT_OPEN");
    }

    const article = await prisma.article.findUnique({
      where: { id: parsed.data.articleId },
      select: { id: true, code: true, name: true, type: true },
    });

    if (!article) {
      return folioFailure("ARTICLE_NOT_FOUND");
    }

    if (article.type === ArticleType.TAX) {
      return folioFailure("PROTECTED_TAX_ARTICLE");
    }

    if (
      STAY_CHARGE_ARTICLE_CODES.some((code) => code === article.code) ||
      STAY_FEE_ARTICLE_CODES.some((code) => code === article.code)
    ) {
      return folioFailure("PROTECTED_STAY_ARTICLE");
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
              throw new ChargeDomainError("FOLIO_NOT_FOUND");
            }

            if (currentFolio.status !== FolioStatus.OPEN) {
              throw new ChargeDomainError("FOLIO_NOT_OPEN");
            }

            await tx.folioLineItem.create({
              data: {
                articleId: article.id,
                folioId: currentFolio.id,
                description,
                quantity: parsed.data.quantity,
                unitPrice: parsed.data.unitPrice,
                amount,
                postedById: authResult.userId,
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
        unstable_rethrow(error);

        if (error instanceof ChargeDomainError) {
          return folioFailure(error.code);
        }

        if (
          isChargeSerializationConflict(error) &&
          attempt < MAX_CHARGE_ATTEMPTS
        ) {
          continue;
        }

        if (isChargeSerializationConflict(error)) {
          logActionFailure("postCharge", error, {
            action: "postCharge",
            stage: "transaction",
            folioId: folio.id,
            articleId: article.id,
            attempt,
            committed: false,
          });
          return folioFailure("CHARGE_CONFLICT");
        }

        logActionFailure("postCharge", error, {
          action: "postCharge",
          stage: "transaction",
          folioId: folio.id,
          articleId: article.id,
          attempt,
          committed: false,
        });

        return folioFailure("CHARGE_UNEXPECTED");
      }
    }

    if (!chargePosted) {
      return folioFailure("CHARGE_CONFLICT");
    }

    await runPostCommitSideEffects(
      [
        {
          name: "logActivity",
          run: () =>
            logActivity({
              userId: authResult.userId,
              action: "FOLIO_CHARGE_POSTED",
              folioId: folio.id,
              metadata: { amount: amount.toNumber() },
            }),
        },
        {
          name: "revalidate:folio",
          run: () => revalidatePath(`/app/fo/folios/${folio.id}`),
        },
        {
          name: "revalidate:reservation",
          run: () => revalidatePath(`/app/fo/reservasi/${folio.reservationId}`),
        },
      ],
      {
        action: "postCharge",
        stage: "post-commit",
        folioId: folio.id,
        committed: true,
      },
    );

    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);

    logActionFailure("postCharge", error, {
      action: "postCharge",
      stage: "pre-commit",
      folioId: folioIdForLog,
      articleId: articleIdForLog,
      committed: false,
    });

    return folioFailure("CHARGE_UNEXPECTED");
  }
}

export async function recordPayment(
  formData: FormData,
): Promise<FolioActionResult> {
  let folioIdForLog: number | undefined;

  try {
    const authResult = await canManageFoFolio();
    if (!authResult.ok) {
      return authResult;
    }

    const parsed = PaymentSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return folioFailure("INVALID_INPUT");
    }

    folioIdForLog = parsed.data.folioId;

    const folio = await prisma.folio.findUnique({
      where: { id: parsed.data.folioId },
      select: { id: true, reservationId: true, status: true },
    });

    if (!folio) {
      return folioFailure("FOLIO_NOT_FOUND");
    }

    if (folio.status !== FolioStatus.OPEN) {
      return folioFailure("FOLIO_NOT_OPEN");
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
              throw new PaymentDomainError("FOLIO_NOT_FOUND");
            }

            if (currentFolio.status !== FolioStatus.OPEN) {
              throw new PaymentDomainError("FOLIO_NOT_OPEN");
            }

            await tx.payment.create({
              data: {
                folioId: currentFolio.id,
                fbOrderId: null,
                amount: parsed.data.amount,
                method: parsed.data.method,
                reference: parsed.data.reference || null,
                receivedById: authResult.userId,
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
        unstable_rethrow(error);

        if (error instanceof PaymentDomainError) {
          return folioFailure(error.code);
        }

        if (
          isPaymentSerializationConflict(error) &&
          attempt < MAX_PAYMENT_ATTEMPTS
        ) {
          continue;
        }

        if (isPaymentSerializationConflict(error)) {
          logActionFailure("recordPayment", error, {
            action: "recordPayment",
            stage: "transaction",
            folioId: folio.id,
            attempt,
            committed: false,
          });
          return folioFailure("PAYMENT_CONFLICT");
        }

        logActionFailure("recordPayment", error, {
          action: "recordPayment",
          stage: "transaction",
          folioId: folio.id,
          attempt,
          committed: false,
        });

        return folioFailure("PAYMENT_UNEXPECTED");
      }
    }

    if (!paymentRecorded) {
      return folioFailure("PAYMENT_CONFLICT");
    }

    await runPostCommitSideEffects(
      [
        {
          name: "logActivity",
          run: () =>
            logActivity({
              userId: authResult.userId,
              action: "PAYMENT_RECORDED",
              folioId: folio.id,
              metadata: {
                amount: parsed.data.amount,
                method: parsed.data.method,
              },
            }),
        },
        {
          name: "revalidate:folio",
          run: () => revalidatePath(`/app/fo/folios/${folio.id}`),
        },
        {
          name: "revalidate:reservation",
          run: () => revalidatePath(`/app/fo/reservasi/${folio.reservationId}`),
        },
      ],
      {
        action: "recordPayment",
        stage: "post-commit",
        folioId: folio.id,
        committed: true,
      },
    );

    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);

    logActionFailure("recordPayment", error, {
      action: "recordPayment",
      stage: "pre-commit",
      folioId: folioIdForLog,
      committed: false,
    });

    return folioFailure("PAYMENT_UNEXPECTED");
  }
}
