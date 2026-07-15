"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { computeArr } from "@/lib/arr";
import { addDateOnlyDays } from "@/lib/date-only";
import { formatCompactDateTimeID } from "@/lib/format";
import {
  buildAuditStayChargeLines,
  buildNightAuditPlan,
  type NightAuditLineItemInput,
} from "@/lib/night-audit";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import {
  ROOM_CHARGE_ARTICLE_CODE,
  StayChargePostingError,
  STAY_CHARGE_ARTICLE_CODES,
} from "@/lib/stay-charges";

import { toArrDisplayData, type ArrDisplayData } from "../arr-display";
import { RunNightAuditSchema } from "./schema";

export type NightAuditRunSummary = {
  auditId: number;
  businessDateLabel: string;
  roomRevenue: string;
  fbRevenue: string;
  otherRevenue: string;
  totalRevenue: string;
  warnings: string[];
  runAtLabel?: string;
  runByName?: string;
  roomsCharged?: number;
  lineItemsPosted?: number;
  transactionWriteCount?: number;
  arr: ArrDisplayData;
};

export type NightAuditRunResult =
  | { ok: true; summary: NightAuditRunSummary }
  | { ok: false; error: string; warnings?: string[] };

const MAX_AUDIT_ATTEMPTS = 3;

async function canRunNightAudit() {
  const session = await auth();

  if (session?.user.role !== "ACC") {
    return null;
  }

  return Number(session.user.id);
}

function revalidateNightAuditPaths(folioIds: number[], reservationIds: number[]) {
  revalidatePath("/app/acc");
  revalidatePath("/app/acc/night-audit");
  revalidatePath("/app/fo/reservasi/kalender");
  revalidatePath("/app/fo/reservasi/list");
  revalidatePath("/app/fo/folios/[id]", "page");
  revalidatePath("/app/fo/reservasi/[id]", "page");

  for (const folioId of folioIds) {
    revalidatePath(`/app/fo/folios/${folioId}`);
  }

  for (const reservationId of reservationIds) {
    revalidatePath(`/app/fo/reservasi/${reservationId}`);
  }
}

function uniqueBusinessDateError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes("business_date")
  );
}

function retryableAuditPostingConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" ||
      (error.code === "P2002" && !uniqueBusinessDateError(error)))
  );
}

export async function runNightAudit(): Promise<NightAuditRunResult> {
  const userId = await canRunNightAudit();

  if (!userId) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = RunNightAuditSchema.safeParse({});

  if (!parsed.success) {
    return { ok: false, error: "Invalid night audit request" };
  }

  const plan = await buildNightAuditPlan({ runById: userId });

  if (plan.existingAudit) {
    return {
      ok: false,
      error: `Night audit untuk ${plan.businessDateLabel} sudah selesai.`,
      warnings: plan.warnings,
    };
  }

  if (plan.blockingErrors.length > 0) {
    return {
      ok: false,
      error: plan.blockingErrors.join(" "),
      warnings: plan.warnings,
    };
  }

  const now = new Date();

  for (let attempt = 1; attempt <= MAX_AUDIT_ATTEMPTS; attempt += 1) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const articles = await tx.article.findMany({
            where: { code: { in: [...STAY_CHARGE_ARTICLE_CODES] } },
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
              defaultPrice: true,
            },
          });
          const roomArticleId = articles.find(
            (article) => article.code === ROOM_CHARGE_ARTICLE_CODE,
          )?.id;
          const lineItemsToCreate: NightAuditLineItemInput[] = [];
          const chargedFolioIds = new Set<number>();
          const chargedReservationIds = new Set<number>();
          const reservations = await tx.reservation.findMany({
            where: { status: "CHECKED_IN" },
            orderBy: { reservationNo: "asc" },
            select: {
                id: true,
                reservationNo: true,
                status: true,
                arrangementType: true,
                rateAmount: true,
                arrivalDate: true,
                departureDate: true,
                reservationNights: {
                  select: {
                    id: true,
                    reservationId: true,
                    date: true,
                    rateAmount: true,
                  },
                  orderBy: { date: "asc" },
                },
                folio: {
                  select: {
                    id: true,
                    status: true,
                    lineItems: {
                      select: {
                        articleId: true,
                        fbOrderId: true,
                        reservationNightId: true,
                      },
                    },
                  },
                },
              },
          });

          for (const reservation of reservations) {
            if (!reservation.folio) {
              throw new StayChargePostingError(
                `Posting stay charge ${reservation.reservationNo} diblokir: folio belum tersedia.`,
              );
            }

            if (reservation.folio.status !== "OPEN") {
              throw new StayChargePostingError(
                `Posting stay charge ${reservation.reservationNo} diblokir: folio tidak OPEN.`,
              );
            }

            const lines = buildAuditStayChargeLines({
              reservation: {
                reservationId: reservation.id,
                reservationNo: reservation.reservationNo,
                folioId: reservation.folio.id,
                arrangementType: reservation.arrangementType,
                rateAmount: reservation.rateAmount,
                arrivalDate: reservation.arrivalDate,
                departureDate: reservation.departureDate,
                reservationNights: reservation.reservationNights,
              },
              existingLineItems: reservation.folio.lineItems,
              articles,
              businessDate: plan.businessDate,
              postedById: userId,
              postedAt: now,
              label: plan.postingLabel,
            });

            if (lines.length > 0) {
              chargedFolioIds.add(reservation.folio.id);
              chargedReservationIds.add(reservation.id);
              lineItemsToCreate.push(...lines);
            }
          }

          let transactionWriteCount = 0;

          if (lineItemsToCreate.length > 0) {
            await tx.folioLineItem.createMany({ data: lineItemsToCreate });
            transactionWriteCount += 1;
          }

          // Only rows inserted by this transaction contribute posting revenue.
          // A concurrent checkout that wins is observed by the retry/re-read and
          // never counted as revenue posted by this audit.
          const roomRevenue = lineItemsToCreate
            .filter((line) => line.articleId === roomArticleId)
            .reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));
          const inclusionRevenue = lineItemsToCreate
            .filter((line) => line.articleId !== roomArticleId)
            .reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));
          const fbRevenue = inclusionRevenue.plus(
            new Prisma.Decimal(plan.closedFbRevenue),
          );
          const totalRevenue = roomRevenue
            .plus(fbRevenue)
            .plus(plan.snapshot.otherRevenue);

          const audit = await tx.nightAudit.create({
            data: {
              ...plan.snapshot,
              roomRevenue,
              fbRevenue,
              totalRevenue,
            },
            select: {
              id: true,
              runAt: true,
              runBy: { select: { fullName: true } },
            },
          });
          transactionWriteCount += 1;

          return {
            auditId: audit.id,
            runAt: audit.runAt,
            runByName: audit.runBy.fullName,
            transactionWriteCount,
            lineItemsPosted: lineItemsToCreate.length,
            roomsCharged: chargedFolioIds.size,
            chargedFolioIds: [...chargedFolioIds],
            chargedReservationIds: [...chargedReservationIds],
            roomRevenue: roomRevenue.toString(),
            fbRevenue: fbRevenue.toString(),
            totalRevenue: totalRevenue.toString(),
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          ...TRANSACTION_OPTIONS,
        },
      );

      revalidateNightAuditPaths(
        result.chargedFolioIds,
        result.chargedReservationIds,
      );
      let arr: ArrDisplayData;
      try {
        arr = toArrDisplayData(
          await computeArr({
            fromInclusive: plan.businessDate,
            toExclusive: addDateOnlyDays(plan.businessDate, 1),
          }),
        );
      } catch {
        const businessDate = plan.businessDate.toISOString().slice(0, 10);
        arr = {
          status: "INTEGRITY_ERROR",
          numerator: "0",
          paidRoomNights: 0,
          arr: null,
          fromInclusive: businessDate,
          toExclusive: addDateOnlyDays(plan.businessDate, 1)
            .toISOString()
            .slice(0, 10),
          cutoverDate: businessDate,
          reason:
            "Night Audit selesai, tetapi query ARR live gagal. Muat ulang dashboard untuk mencoba kembali.",
        };
      }

      return {
        ok: true,
        summary: {
          auditId: result.auditId,
          businessDateLabel: plan.businessDateLabel,
          runAtLabel: formatCompactDateTimeID(result.runAt),
          runByName: result.runByName,
          roomsCharged: result.roomsCharged,
          lineItemsPosted: result.lineItemsPosted,
          roomRevenue: result.roomRevenue,
          fbRevenue: result.fbRevenue,
          otherRevenue: plan.otherRevenue,
          totalRevenue: result.totalRevenue,
          warnings: plan.warnings,
          transactionWriteCount: result.transactionWriteCount,
          arr,
        },
      };
    } catch (error) {
      if (uniqueBusinessDateError(error)) {
        return {
          ok: false,
          error: `Night audit untuk ${plan.businessDateLabel} sudah dijalankan oleh sesi lain.`,
          warnings: plan.warnings,
        };
      }

      if (error instanceof StayChargePostingError) {
        return { ok: false, error: error.message, warnings: plan.warnings };
      }

      if (retryableAuditPostingConflict(error) && attempt < MAX_AUDIT_ATTEMPTS) {
        continue;
      }

      if (retryableAuditPostingConflict(error)) {
        return {
          ok: false,
          error: "Konflik posting Night Audit berulang. Muat ulang dan coba lagi.",
          warnings: plan.warnings,
        };
      }

      throw error;
    }
  }

  return {
    ok: false,
    error: "Konflik posting Night Audit berulang. Muat ulang dan coba lagi.",
    warnings: plan.warnings,
  };
}
