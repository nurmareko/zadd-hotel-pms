"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { computeArr } from "@/lib/arr";
import { addDateOnlyDays } from "@/lib/date-only";
import {
  executeNightAudit,
  type NightAuditBlocker,
  type NightAuditDomainRunSummary,
} from "@/lib/night-audit";

import { toArrDisplayData, type ArrDisplayData } from "../arr-display";
import { RunNightAuditSchema } from "./schema";

export type NightAuditRunSummary = NightAuditDomainRunSummary & {
  arr: ArrDisplayData;
};

export type NightAuditRunResult =
  | { ok: true; summary: NightAuditRunSummary }
  | {
      ok: false;
      error: string;
      warnings?: string[];
      blockingErrors?: NightAuditBlocker[];
    };

async function canRunNightAudit() {
  const session = await auth();

  if (session?.user.role !== "ACC") {
    return null;
  }

  return Number(session.user.id);
}

function revalidateNightAuditPaths(
  folioIds: number[],
  reservationIds: number[],
) {
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

export async function runNightAudit(): Promise<NightAuditRunResult> {
  const userId = await canRunNightAudit();

  if (!userId) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = RunNightAuditSchema.safeParse({});

  if (!parsed.success) {
    return { ok: false, error: "Invalid night audit request" };
  }

  const result = await executeNightAudit({ runById: userId });

  if (!result.ok) {
    return result;
  }

  revalidateNightAuditPaths(
    result.summary.chargedFolioIds ?? [],
    result.summary.chargedReservationIds ?? [],
  );

  let arr: ArrDisplayData;
  const businessDate = result.summary.businessDate ?? new Date();
  try {
    arr = toArrDisplayData(
      await computeArr({
        fromInclusive: businessDate,
        toExclusive: addDateOnlyDays(businessDate, 1),
      }),
    );
  } catch {
    const dateStr = businessDate.toISOString().slice(0, 10);
    arr = {
      status: "INTEGRITY_ERROR",
      numerator: "0",
      paidRoomNights: 0,
      arr: null,
      fromInclusive: dateStr,
      toExclusive: addDateOnlyDays(businessDate, 1).toISOString().slice(0, 10),
      cutoverDate: dateStr,
      reason:
        "Night Audit selesai, tetapi query ARR live gagal. Muat ulang dashboard untuk mencoba kembali.",
    };
  }

  return {
    ok: true,
    summary: {
      ...result.summary,
      arr,
    },
  };
}
