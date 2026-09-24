import {
  FBOrderStatus,
  NightAuditStatus,
  Prisma,
  ReservationStatus,
  ReservationType,
} from "@prisma/client";

import { computeArr, getArrCutover, inclusiveArrRange, type ArrStatus } from "@/lib/arr";
import {
  addDateOnlyDays,
  hotelTodayISO,
  hotelTimestampBoundaryForDate,
  isValidISODateOnly,
  parseISODateOnly,
} from "@/lib/date-only";
import { classifyNightAuditRevenues } from "@/lib/night-audit";
import { prisma } from "@/lib/prisma";

export type RevenueReportRange = { from: string; to: string };

export type RevenueReportSummary = {
  totalRevenue: number;
  roomRevenue: number;
  fbRevenue: number;
  otherRevenue: number;
  /** Sum of daily room inventory (available room nights), not distinct rooms. */
  totalRooms: number;
  /** Sum of daily occupied rooms (occupied room nights). */
  occupiedRooms: number;
  occupancyRate: number;
  /** UI must use arrStatus; zero is only a backing value for non-authoritative ARR. */
  arr: number;
  arrStatus: ArrStatus;
  revPar: number;
};

export type DailyRevenueRow = Omit<RevenueReportSummary, "occupiedRooms"> & {
  date: string;
  roomsOccupied: number;
};

export type RevenueBookingSource = {
  type: ReservationType;
  label: string;
  revenue: number;
  percentage: number;
  reservationCount: number;
  roomNights: number;
};

/**
 * UI contract:
 * - from/to are normalized inclusive dates; dailyRows are ascending.
 * - occupancyRate and source percentage are on a 0–100 scale, unrounded.
 * - Source percentages use attributed revenue only, NOT summary.totalRevenue.
 *   The UI must explain this denominator and show unattributedRevenue separately.
 * - Sources use current provenance, unique eligible reservations with nights in
 *   the range, and their non-cancelled/non-no-show room nights (including COMP).
 *   Revenue is posted revenue regardless of the reservation's current status.
 * - Closed daily metrics are immutable audit snapshots, including inventory;
 *   open days use current inventory and Manager Flash's distinct-room convention.
 *   No current OOO status is applied retroactively to historical inventory.
 * - Sources and ARR are live, even for closed dates. Sources + unattributedRevenue
 *   need not reconcile to snapshot totals; never rescale them to force a match.
 * - The caller owns authentication/role gating. This is a read-only server loader,
 *   not a server action or a cached historical accounting snapshot.
 */
export type RevenueReportData = RevenueReportRange & {
  summary: RevenueReportSummary;
  sources: RevenueBookingSource[];
  dailyRows: DailyRevenueRow[];
  /** Closed F&B orders with no charged folio; never attributed to WALK_IN. */
  unattributedRevenue: number;
};

export function safeDivide(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

const dateKey = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Missing endpoints default independently to hotel month start / today. Invalid
 * or reversed ranges fall back to that entire default. Future endpoints clamp to
 * today. Keep only the latest 366 inclusive days ending at the resolved `to`.
 * UI date controls must display the returned range, not the original request.
 * `today` is an optional valid ISO date-only clock override for deterministic use.
 */
export function resolveRevenueReportRange(
  input: { from?: string; to?: string },
  today = hotelTodayISO(),
): RevenueReportRange {
  parseISODateOnly(today);
  const fallback = { from: `${today.slice(0, 7)}-01`, to: today };
  let from = input.from ?? fallback.from;
  let to = input.to ?? fallback.to;
  if (!isValidISODateOnly(from) || !isValidISODateOnly(to) || from > to) {
    return fallback;
  }
  from = from > today ? today : from;
  to = to > today ? today : to;
  const earliest = dateKey(addDateOnlyDays(parseISODateOnly(to), -365));
  return { from: from < earliest ? earliest : from, to };
}

const sourceLabels: Record<ReservationType, string> = {
  INDIVIDUAL: "Perorangan",
  COMPANY: "Perusahaan",
  GOVERNMENT: "Pemerintah",
  OTA: "Agen Perjalanan Daring",
  WALK_IN: "Tamu Datang Langsung",
};

const lineSelect = {
  amount: true,
  article: { select: { code: true, type: true } },
  reservationNight: { select: { date: true } },
  postedAt: true,
  folio: { select: { reservation: { select: { reservationType: true } } } },
} satisfies Prisma.FolioLineItemSelect;

type RevenueLine = Prisma.FolioLineItemGetPayload<{ select: typeof lineSelect }>;

export async function getRevenueReport(input: RevenueReportRange): Promise<RevenueReportData> {
  const { from, to } = resolveRevenueReportRange(input);
  const range = inclusiveArrRange(from, to);
  const dates = { gte: range.fromInclusive, lt: range.toExclusive };
  const timestamps = {
    gte: hotelTimestampBoundaryForDate(from),
    lt: hotelTimestampBoundaryForDate(dateKey(range.toExclusive)),
  };
  const [audits, totalRooms, reservations, stayLines, unlinkedLines, closedOrders] = await Promise.all([
    prisma.nightAudit.findMany({
      where: { status: NightAuditStatus.COMPLETED, businessDate: dates },
      select: {
        businessDate: true, totalRooms: true, roomsOccupied: true, occupancyRate: true,
        roomRevenue: true, fbRevenue: true, otherRevenue: true, totalRevenue: true,
      },
    }),
    prisma.room.count(),
    prisma.reservation.findMany({
      where: {
        status: { notIn: [ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW] },
        OR: [
          { reservationNights: { some: { date: dates } } },
          { arrivalDate: { lt: range.toExclusive }, departureDate: { gt: range.fromInclusive } },
        ],
      },
      select: {
        id: true, reservationType: true, roomId: true, arrivalDate: true, departureDate: true,
        reservationNights: { where: { date: dates }, select: { id: true } },
      },
    }),
    // These two windows are disjoint. Linked lines belong to the service night,
    // even if posted later by catch-up; unlinked lines belong to their WIB day.
    prisma.folioLineItem.findMany({
      where: { fbOrderId: null, reservationNight: { date: dates } },
      select: lineSelect,
    }),
    prisma.folioLineItem.findMany({
      where: { fbOrderId: null, reservationNightId: null, postedAt: timestamps },
      select: lineSelect,
    }),
    // FB-linked folio lines above are excluded: the closed order owns its amount.
    prisma.fBOrder.findMany({
      where: { status: FBOrderStatus.CLOSED, closedAt: timestamps },
      select: {
        total: true, closedAt: true,
        chargedFolio: { select: { reservation: { select: { reservationType: true } } } },
      },
    }),
  ]);

  const buckets = new Map<string, { lines: RevenueLine[]; fbRevenue: Prisma.Decimal }>();
  for (let cursor = range.fromInclusive; cursor < range.toExclusive; cursor = addDateOnlyDays(cursor, 1)) {
    buckets.set(dateKey(cursor), { lines: [], fbRevenue: new Prisma.Decimal(0) });
  }
  const sourceRows = new Map(
    Object.values(ReservationType).map((type) => [type, {
      type, label: sourceLabels[type], revenue: 0, reservationIds: new Set<number>(), roomNights: 0,
    }]),
  );
  for (const reservation of reservations) {
    if (reservation.reservationNights.length === 0) continue;
    const row = sourceRows.get(reservation.reservationType)!;
    row.reservationIds.add(reservation.id);
    row.roomNights += reservation.reservationNights.length;
  }
  for (const line of [...stayLines, ...unlinkedLines]) {
    const day = line.reservationNight ? dateKey(line.reservationNight.date) : hotelTodayISO(line.postedAt);
    buckets.get(day)?.lines.push(line);
    sourceRows.get(line.folio.reservation.reservationType)!.revenue += Number(line.amount);
  }
  let unattributedRevenue = 0;
  for (const order of closedOrders) {
    // The query excludes null closedAt; retain the guard for the nullable schema.
    if (order.closedAt === null) continue;
    const bucket = buckets.get(hotelTodayISO(order.closedAt));
    if (bucket) bucket.fbRevenue = bucket.fbRevenue.plus(order.total);
    if (order.chargedFolio) {
      sourceRows.get(order.chargedFolio.reservation.reservationType)!.revenue += Number(order.total);
    } else {
      unattributedRevenue += Number(order.total);
    }
  }
  const attributedRevenue = [...sourceRows.values()].reduce((sum, row) => sum + row.revenue, 0);
  const sources = [...sourceRows.values()]
    .map(({ reservationIds, ...row }) => ({
      ...row,
      reservationCount: reservationIds.size,
      percentage: safeDivide(row.revenue, attributedRevenue) * 100,
    }))
    .filter((row) => row.revenue !== 0 || row.reservationCount !== 0 || row.roomNights !== 0);

  const auditByDate = new Map(audits.map((audit) => [dateKey(audit.businessDate), audit]));
  const resolvedCutover = await getArrCutover();
  // Period ARR is authoritative weighted ARR, never an average of daily ARR.
  const periodArr = await computeArr({ ...range, resolvedCutover });
  const dailyRows: DailyRevenueRow[] = [];
  const days = [...buckets.keys()];
  // Bound ARR database work: never launch 366 concurrent canonical queries.
  const arrConcurrency = 4;
  for (let offset = 0; offset < days.length; offset += arrConcurrency) {
    const batch = await Promise.all(days.slice(offset, offset + arrConcurrency).map(async (day) => {
      const arr = await computeArr({ ...inclusiveArrRange(day, day), resolvedCutover });
      const audit = auditByDate.get(day);
      const inventory = audit?.totalRooms ?? totalRooms;
      let roomsOccupied: number;
      let occupancyRate: number;
      let revenues: Pick<DailyRevenueRow, "roomRevenue" | "fbRevenue" | "otherRevenue" | "totalRevenue">;
      if (audit) {
        roomsOccupied = audit.roomsOccupied;
        occupancyRate = Number(audit.occupancyRate);
        revenues = {
          roomRevenue: Number(audit.roomRevenue), fbRevenue: Number(audit.fbRevenue),
          otherRevenue: Number(audit.otherRevenue), totalRevenue: Number(audit.totalRevenue),
        };
      } else {
        const dayOnly = parseISODateOnly(day);
        roomsOccupied = new Set(reservations
          .filter((reservation) => reservation.roomId !== null && reservation.arrivalDate <= dayOnly && reservation.departureDate > dayOnly)
          .map((reservation) => reservation.roomId)).size;
        occupancyRate = safeDivide(roomsOccupied, inventory) * 100;
        const bucket = buckets.get(day)!;
        const classified = classifyNightAuditRevenues({
          shortfallLineItems: [], existingDaytimeFolioLines: bucket.lines,
          closedFbRevenueTotal: bucket.fbRevenue, roomArticleId: undefined,
        });
        revenues = {
          roomRevenue: Number(classified.roomRevenue), fbRevenue: Number(classified.fbRevenue),
          otherRevenue: Number(classified.otherRevenue), totalRevenue: Number(classified.totalRevenue),
        };
      }
      return {
        date: day, totalRooms: inventory, roomsOccupied, occupancyRate, ...revenues,
        arr: arr.status === "AUTHORITATIVE" ? Number(arr.arr) : 0,
        arrStatus: arr.status,
        revPar: safeDivide(revenues.roomRevenue, inventory),
      };
    }));
    dailyRows.push(...batch);
  }
  const totals = dailyRows.reduce((sum, row) => ({
    totalRevenue: sum.totalRevenue + row.totalRevenue,
    roomRevenue: sum.roomRevenue + row.roomRevenue,
    fbRevenue: sum.fbRevenue + row.fbRevenue,
    otherRevenue: sum.otherRevenue + row.otherRevenue,
    totalRooms: sum.totalRooms + row.totalRooms,
    occupiedRooms: sum.occupiedRooms + row.roomsOccupied,
  }), { totalRevenue: 0, roomRevenue: 0, fbRevenue: 0, otherRevenue: 0, totalRooms: 0, occupiedRooms: 0 });

  return {
    from, to, sources, dailyRows, unattributedRevenue,
    summary: {
      ...totals,
      occupancyRate: safeDivide(totals.occupiedRooms, totals.totalRooms) * 100,
      arr: periodArr.status === "AUTHORITATIVE" ? Number(periodArr.arr) : 0,
      arrStatus: periodArr.status,
      revPar: safeDivide(totals.roomRevenue, totals.totalRooms),
    },
  };
}
