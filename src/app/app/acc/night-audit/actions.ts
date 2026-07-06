"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { formatCompactDateTimeID } from "@/lib/format";
import {
  buildAuditStayChargeLines,
  buildNightAuditPlan,
  type NightAuditLineItemInput,
} from "@/lib/night-audit";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { ROOM_CHARGE_ARTICLE_CODE } from "@/lib/stay-charges";

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
};

export type NightAuditRunResult =
  | { ok: true; summary: NightAuditRunSummary }
  | { ok: false; error: string; warnings?: string[] };

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
  const roomArticleId = plan.stayChargeArticles.find(
    (article) => article.code === ROOM_CHARGE_ARTICLE_CODE,
  )?.id;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const lineItemsToCreate: NightAuditLineItemInput[] = [];
        const chargedFolioIds = new Set<number>();

        // Re-read each open folio's line items inside the transaction and post
        // only the shortfall, so a check-out catch-up that posted a night
        // between plan and commit cannot be double-posted here.
        for (const reservation of plan.stayChargeReservations) {
          const folio = await tx.folio.findUnique({
            where: { id: reservation.folioId },
            select: {
              status: true,
              lineItems: { select: { articleId: true } },
            },
          });

          // Skip folios closed (e.g. checked out) between plan and commit.
          if (!folio || folio.status !== "OPEN") {
            continue;
          }

          const lines = buildAuditStayChargeLines({
            reservation,
            existingLineItems: folio.lineItems,
            articles: plan.stayChargeArticles,
            businessDate: plan.businessDate,
            postedById: userId,
            postedAt: now,
            label: plan.postingLabel,
          });

          if (lines.length > 0) {
            chargedFolioIds.add(reservation.folioId);
            lineItemsToCreate.push(...lines);
          }
        }

        let transactionWriteCount = 0;

        if (lineItemsToCreate.length > 0) {
          await tx.folioLineItem.createMany({ data: lineItemsToCreate });
          transactionWriteCount += 1;
        }

        // Snapshot revenue reflects what was actually posted, not the plan's
        // projection (which can be larger if a catch-up posted a night first).
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
      plan.affectedFolioIds,
      plan.affectedReservationIds,
    );

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

    throw error;
  }
}
