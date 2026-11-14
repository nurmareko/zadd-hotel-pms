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
import { assertBusinessDateOpen, NightAuditClosedError } from "@/lib/night-audit";
import type { Capability } from "@/lib/permissions";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { STAY_FEE_ARTICLE_CODES } from "@/lib/reservation-stay-fee-definitions";
import { STAY_CHARGE_ARTICLE_CODES } from "@/lib/stay-charges";
import {
  folioFailure,
  transferFailure,
  type TransferFailureCode,
  type TransferFolioActionResult,
  type FolioActionResult,
  type FolioFailure,
  type FolioFailureCode,
} from "./errors";
import {
  PaymentSchema,
  PostChargeSchema,
  TransferFolioItemSchema,
  type TransferFolioLineItemInput,
} from "./schema";

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

async function canManageFoFolio(
  capability: Capability = "folio:charge",
): Promise<{ ok: true; userId: number } | FolioFailure> {
  const session = await auth();

  const authFailure = checkActionAuthorization(session, capability);
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
            const now = new Date();
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

            try {
              await assertBusinessDateOpen(tx, now);
            } catch (error) {
              if (error instanceof NightAuditClosedError) {
                throw new ChargeDomainError("NIGHT_AUDIT_CLOSED");
              }
              throw error;
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
                postedAt: now,
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
              metadata: {
                              amount: amount.toNumber(),
                              ...(parsed.data.unitPrice < 0
                                ? { correction: true, articleId: article.id, reason: description }
                                : {}),
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

class TransferDomainError extends Error {
  constructor(readonly code: TransferFailureCode) {
    super(code);
  }
}

async function transferFolioLineItemOperation(
  input: TransferFolioLineItemInput,
  userId: number,
) {
  if (input.sourceFolioId === input.targetFolioId) {
    throw new TransferDomainError("TRANSFER_SAME_FOLIO");
  }

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const line = await tx.folioLineItem.findUnique({ where: { id: input.lineItemId } });
        if (!line || (input.sourceFolioId !== undefined && line.folioId !== input.sourceFolioId)) {
          throw new TransferDomainError("TRANSFER_LINE_NOT_FOUND");
        }
        // Accounting export counts linked orders per folio without netting reversals.
        if (line.fbOrderId !== null) {
          throw new TransferDomainError("TRANSFER_FB_UNSUPPORTED");
        }
        const sourceFolioId = line.folioId;
        if (sourceFolioId === input.targetFolioId) {
          throw new TransferDomainError("TRANSFER_SAME_FOLIO");
        }
        const folios = new Map<number, { reservationId: number; reservationNo: string }>();
        for (const id of [sourceFolioId, input.targetFolioId].sort((a, b) => a - b)) {
          const folio = await tx.folio.findUnique({
            where: { id },
            select: {
              status: true, reservationId: true,
              reservation: { select: { reservationNo: true } },
            },
          });
          if (!folio) throw new TransferDomainError("FOLIO_NOT_FOUND");
          if (folio.status !== FolioStatus.OPEN) throw new TransferDomainError("FOLIO_NOT_OPEN");
          folios.set(id, { reservationId: folio.reservationId, reservationNo: folio.reservation.reservationNo });
        }
        const source = folios.get(sourceFolioId)!;
        const target = folios.get(input.targetFolioId)!;
        if (line.amount.isNegative() || line.unitPrice.isNegative() || line.quantity.isNegative()) {
          throw new TransferDomainError("TRANSFER_NEGATIVE_CHARGE");
        }

        // The predicate read and audit insert must share the serializable transaction:
        // concurrent transfers of this same original cannot both commit.
        const previous = await tx.activityLog.findFirst({
          where: {
            action: "FOLIO_CHARGE_POSTED",
            folioId: sourceFolioId,
            AND: [
              { metadata: { path: ["type"], equals: "TRANSFER" } },
              { metadata: { path: ["lineItemId"], equals: input.lineItemId } },
            ],
          },
          select: { id: true },
        });
        if (previous) throw new TransferDomainError("TRANSFER_ALREADY_COMPLETED");

        const now = new Date();
        await assertBusinessDateOpen(tx, now);
        const common = {
          articleId: line.articleId,
          fbOrderId: line.fbOrderId,
          quantity: line.quantity,
          postedById: userId,
          postedAt: now,
        };

        // Leave reservationNightId on the original to preserve automatic-posting identity.
        // Copy stored amounts rather than recomputing rounded historical charges.
        const reversal = await tx.folioLineItem.create({
          data: {
            ...common,
            folioId: sourceFolioId,
            description: `Transfer out to Folio #${input.targetFolioId} (${target.reservationNo}): ${line.description}`.slice(0, 255),
            unitPrice: line.unitPrice.negated(),
            amount: line.amount.negated(),
          },
        });
        const destination = await tx.folioLineItem.create({
          data: {
            ...common,
            folioId: input.targetFolioId,
            description: `Transfer in from Folio #${sourceFolioId} (${source.reservationNo}): ${line.description}`.slice(0, 255),
            unitPrice: line.unitPrice,
            amount: line.amount,
          },
        });
        await tx.activityLog.create({
          data: {
            userId,
            action: "FOLIO_CHARGE_POSTED",
            folioId: sourceFolioId,
            reservationId: source.reservationId,
            metadata: {
              event: "TRANSFER",
              type: "TRANSFER",
              sourceFolioId,
              targetFolioId: input.targetFolioId,
              lineItemId: line.id,
              reversalLineItemId: reversal.id,
              destinationLineItemId: destination.id,
              reason: input.reason,
              amount: line.amount.toString(),
            },
          },
        });
        return { sourceFolioId, sourceReservationId: source.reservationId, targetReservationId: target.reservationId };
      }, {
        ...TRANSACTION_OPTIONS,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      unstable_rethrow(error);
      if (isChargeSerializationConflict(error) && attempt < 3) continue;
      throw error;
    }
  }
}

export async function transferFolioLineItem(formData: FormData): Promise<TransferFolioActionResult> {
  let sourceFolioId: number | undefined;
  let targetFolioId: number | undefined;
  let lineItemId: number | undefined;
  try {
    const authorization = await canManageFoFolio("folio:charge");
    if (!authorization.ok) return authorization;
    const parsed = TransferFolioItemSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return folioFailure("INVALID_INPUT");
    ({ sourceFolioId, targetFolioId, lineItemId } = parsed.data);

    const result = await transferFolioLineItemOperation(parsed.data, authorization.userId);
    sourceFolioId = result.sourceFolioId;
    await runPostCommitSideEffects([
      { name: "revalidate:source-folio", run: () => revalidatePath(`/app/fo/folios/${sourceFolioId}`) },
      { name: "revalidate:target-folio", run: () => revalidatePath(`/app/fo/folios/${targetFolioId}`) },
      { name: "revalidate:source-reservation", run: () => revalidatePath(`/app/fo/reservasi/${result.sourceReservationId}`) },
      { name: "revalidate:target-reservation", run: () => revalidatePath(`/app/fo/reservasi/${result.targetReservationId}`) },
    ], { action: "transferFolioLineItem", stage: "post-commit", folioId: sourceFolioId, committed: true });
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof TransferDomainError) return transferFailure(error.code);
    if (error instanceof NightAuditClosedError) return folioFailure("NIGHT_AUDIT_CLOSED");
    logActionFailure("transferFolioLineItem", error, {
      action: "transferFolioLineItem", stage: "transaction",
      sourceFolioId, targetFolioId, lineItemId, committed: false,
    });
    return transferFailure(isChargeSerializationConflict(error) ? "TRANSFER_CONFLICT" : "TRANSFER_UNEXPECTED");
  }
}

export async function recordPayment(
  formData: FormData,
): Promise<FolioActionResult> {
  let folioIdForLog: number | undefined;

  try {
    const authResult = await canManageFoFolio("folio:settle");
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
