"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { buildNightAuditPlan } from "@/lib/night-audit";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";

import { RunNightAuditSchema } from "./schema";

export type NightAuditRunSummary = {
  auditId: number;
  businessDateLabel: string;
  roomsCharged: number;
  lineItemsPosted: number;
  roomRevenue: string;
  fbRevenue: string;
  otherRevenue: string;
  totalRevenue: string;
  warnings: string[];
  transactionWriteCount: number;
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
  revalidatePath("/app/fo/dashboard");
  revalidatePath("/app/fo/tape-chart");
  revalidatePath("/app/fo/reservations");
  revalidatePath("/app/fo/folios/[id]", "page");
  revalidatePath("/app/fo/reservations/[id]", "page");

  for (const folioId of folioIds) {
    revalidatePath(`/app/fo/folios/${folioId}`);
  }

  for (const reservationId of reservationIds) {
    revalidatePath(`/app/fo/reservations/${reservationId}`);
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

  try {
    const result = await prisma.$transaction(async (tx) => {
      let transactionWriteCount = 0;

      if (plan.lineItemsToCreate.length > 0) {
        await tx.folioLineItem.createMany({
          data: plan.lineItemsToCreate,
        });
        transactionWriteCount += 1;
      }

      const audit = await tx.nightAudit.create({
        data: plan.snapshot,
        select: { id: true },
      });
      transactionWriteCount += 1;

      return { auditId: audit.id, transactionWriteCount };
    }, TRANSACTION_OPTIONS);

    revalidateNightAuditPaths(
      plan.affectedFolioIds,
      plan.affectedReservationIds,
    );

    return {
      ok: true,
      summary: {
        auditId: result.auditId,
        businessDateLabel: plan.businessDateLabel,
        roomsCharged: plan.roomChargeCount,
        lineItemsPosted: plan.lineItemCount,
        roomRevenue: plan.roomRevenue,
        fbRevenue: plan.fbRevenue,
        otherRevenue: plan.otherRevenue,
        totalRevenue: plan.totalRevenue,
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
