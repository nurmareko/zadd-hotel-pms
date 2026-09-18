import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildLaundryWhere, reconcileLinenBatch, type LaundryFilters } from "./logic";

export type { LaundryFilters } from "./logic";

const batchInclude = {
  recordedBy: { select: { id: true, fullName: true } },
  receivedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.LinenBatchInclude;

/** Timestamps remain Dates; operator IDs are integers and batch IDs are strings. */
export type LinenBatchRow = Prisma.LinenBatchGetPayload<{ include: typeof batchInclude }> & {
  lostQuantity: number | null;
  isReconciled: boolean;
};

export interface LaundrySummaryData {
  cleanCount: number;
  washingCount: number;
  sentCount: number;
  damagedCount: number;
}

async function requireLaundryAccess() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "HK" && session.user.role !== "ADMIN")) {
    throw new Error("Tidak berwenang mengakses data laundry.");
  }
}

/** Counts linen units, not batches. CLEAN counts only usable received units. */
export async function getLaundrySummary(): Promise<LaundrySummaryData> {
  await requireLaundryAccess();
  const groups = await prisma.linenBatch.groupBy({
    by: ["status"],
    _sum: { sentQuantity: true, receivedQuantity: true, damagedQuantity: true },
  });
  const summary: LaundrySummaryData = { cleanCount: 0, washingCount: 0, sentCount: 0, damagedCount: 0 };
  for (const group of groups) {
    if (group.status === "CLEAN") summary.cleanCount += group._sum.receivedQuantity ?? 0;
    if (group.status === "WASHING") summary.washingCount += group._sum.sentQuantity ?? 0;
    if (group.status === "SENT") summary.sentCount += group._sum.sentQuantity ?? 0;
    summary.damagedCount += group._sum.damagedQuantity ?? 0;
  }
  return summary;
}

/** Invalid filters throw ZodError rather than silently broadening the query. */
export async function getLinenBatches(filters: LaundryFilters = {}): Promise<LinenBatchRow[]> {
  await requireLaundryAccess();
  const batches = await prisma.linenBatch.findMany({
    where: buildLaundryWhere(filters),
    include: batchInclude,
    orderBy: [{ sentAt: "desc" }, { id: "desc" }],
  });
  return batches.map((batch) => ({ ...batch, ...reconcileLinenBatch(batch.sentQuantity, batch.receivedQuantity, batch.damagedQuantity) }));
}
