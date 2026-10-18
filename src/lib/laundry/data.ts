import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { buildLaundryWhere, reconcileLinenBatch, type LaundryFilters } from "./logic";

import { GuestLaundryMetadataSchema, type GuestLaundryStatus } from "./guest-schema";

export type { LaundryFilters } from "./logic";

export interface GuestLaundryOrderRecord {
  id: number;
  roomNumber: string | null;
  guestName: string | null;
  items: { articleId: number; name: string; quantity: number; unitPrice: number }[];
  amount: number;
  settlementType: "CHARGE_TO_ROOM" | "DIRECT_TENDER";
  createdAt: Date;
  status: GuestLaundryStatus;
  deliveredAt: string | null;
  deliveredByName: string | null;
  deliveryNotes: string | null;
}

/** All guest orders, including delivered history, with immutable intake item names. */
export async function getGuestLaundryOrders(): Promise<GuestLaundryOrderRecord[]> {
  const session = await auth();
  if (!session?.user || (!can(session.user.role, "laundry:manage") && !can(session.user.role, "laundry:guest-order"))) {
    throw new Error("Not authorized to access guest laundry data.");
  }
  const orders = await prisma.activityLog.findMany({
    where: { action: "FOLIO_CHARGE_POSTED", metadata: { path: ["source"], equals: "GUEST_LAUNDRY" } },
    select: {
      id: true, createdAt: true, metadata: true,
      room: { select: { number: true } },
      reservation: { select: { guest: { select: { fullName: true } } } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const parsedOrders = orders.map((order) => {
    const metadata = GuestLaundryMetadataSchema.safeParse(order.metadata);
    if (!metadata.success) throw new Error("Guest laundry order data is invalid. Contact an administrator.");
    return { order, metadata: metadata.data };
  });
  const deliveryUserIds = [...new Set(parsedOrders.flatMap(({ metadata }) =>
    metadata.deliveredById == null ? [] : [metadata.deliveredById],
  ))];
  const deliveryUsers = deliveryUserIds.length ? await prisma.user.findMany({
    where: { id: { in: deliveryUserIds } }, select: { id: true, fullName: true },
  }) : [];
  const deliveryUserNames = new Map(deliveryUsers.map((user) => [user.id, user.fullName]));
  return parsedOrders.map(({ order, metadata }) => ({
    id: order.id,
    roomNumber: order.room?.number ?? null,
    guestName: order.reservation?.guest.fullName ?? null,
    items: metadata.items,
    amount: metadata.amount,
    settlementType: metadata.settlementType,
    createdAt: order.createdAt,
    status: metadata.status,
    deliveredAt: metadata.deliveredAt ?? null,
    deliveredByName: metadata.deliveredById == null ? null : deliveryUserNames.get(metadata.deliveredById) ?? null,
    deliveryNotes: metadata.deliveryNotes ?? null,
  }));
}

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
  if (!session?.user || !can(session.user.role, "laundry:manage")) {
    throw new Error("Not authorized to access laundry data.");
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
