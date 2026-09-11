import {
  ArticleType,
  FBOrderStatus,
  ReservationStatus,
} from "@prisma/client";

import { computeArr, getArrCutover, type ArrCutoverResult } from "@/lib/arr";
import {
  addDateOnlyDays,
  hotelTodayISO,
  hotelTimestampBoundaryForDate,
  isValidISODateOnly,
  parseISODateOnly,
} from "@/lib/date-only";
import { formatISODate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export type ManagerFlashDay = {
  date: string;
  totalRooms: number;
  roomsOccupied: number;
  occupancyRate: number;
  roomRevenue: number;
  fbRevenue: number;
  otherRevenue: number;
  totalRevenue: number;
  soldRoomNights: number;
  adr: number;
  revPar: number;
  revPax: number;
  inHouseCount: number;
  checkInCount: number;
  checkOutCount: number;
  noShowCount: number;
};

export type ManagerFlashReport = {
  selectedDate: string;
  selected: ManagerFlashDay;
  history: ManagerFlashDay[];
};

function safeDivide(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function dayRange(date: string) {
  const start = hotelTimestampBoundaryForDate(date);
  return { start, end: hotelTimestampBoundaryForDate(formatISODate(addDateOnlyDays(parseISODateOnly(date), 1))) };
}

async function calculateDay(
  date: string,
  totalRooms: number,
  audit: {
    roomsOccupied: number;
    occupancyRate: { toString(): string };
    roomRevenue: { toString(): string };
    fbRevenue: { toString(): string };
    otherRevenue: { toString(): string };
    totalRevenue: { toString(): string };
    inHouseCount: number;
    checkInCount: number;
    checkOutCount: number;
  } | null,
  cutover: ArrCutoverResult,
): Promise<ManagerFlashDay> {
  const dateOnly = parseISODateOnly(date);
  const nextDate = addDateOnlyDays(dateOnly, 1);
  const { start, end } = dayRange(date);
  const [arr, movement, noShowCount] = await Promise.all([
    computeArr({
      fromInclusive: dateOnly,
      toExclusive: nextDate,
      resolvedCutover: cutover,
    }),
    prisma.reservation.findMany({
      where: {
        OR: [
          { arrivalDate: { gte: dateOnly, lt: nextDate } },
          { departureDate: { gte: dateOnly, lt: nextDate } },
          {
            arrivalDate: { lte: dateOnly },
            departureDate: { gt: dateOnly },
          },
        ],
      },
      select: {
        roomId: true,
        status: true,
        arrivalDate: true,
        departureDate: true,
      },
    }),
    prisma.reservation.count({
      where: {
        arrivalDate: { gte: dateOnly, lt: nextDate },
        status: ReservationStatus.NO_SHOW,
      },
    }),
  ]);

  let roomRevenue: number;
  let fbRevenue: number;
  let otherRevenue: number;
  let totalRevenue: number;
  let roomsOccupied: number;
  let inHouseCount: number;
  let checkInCount: number;
  let checkOutCount: number;

  if (audit) {
    roomRevenue = Number(audit.roomRevenue.toString());
    fbRevenue = Number(audit.fbRevenue.toString());
    otherRevenue = Number(audit.otherRevenue.toString());
    totalRevenue = Number(audit.totalRevenue.toString());
    roomsOccupied = audit.roomsOccupied;
    inHouseCount = audit.inHouseCount;
    checkInCount = audit.checkInCount;
    checkOutCount = audit.checkOutCount;
  } else {
    const [lineItems, closedFbRevenue] = await Promise.all([
      prisma.folioLineItem.findMany({
        where: { postedAt: { gte: start, lt: end }, fbOrderId: null },
        select: { amount: true, article: { select: { type: true } } },
      }),
      prisma.fBOrder.aggregate({
        where: { status: FBOrderStatus.CLOSED, closedAt: { gte: start, lt: end } },
        _sum: { total: true },
      }),
    ]);
    roomRevenue = lineItems
      .filter((line) => line.article.type === ArticleType.ROOM)
      .reduce((sum, line) => sum + Number(line.amount), 0);
    const inclusionRevenue = lineItems
      .filter((line) => line.article.type === ArticleType.FB)
      .reduce((sum, line) => sum + Number(line.amount), 0);
    fbRevenue = inclusionRevenue + Number(closedFbRevenue._sum.total ?? 0);
    otherRevenue = lineItems
      .filter(
        (line) =>
          line.article.type !== ArticleType.ROOM &&
          line.article.type !== ArticleType.FB,
      )
      .reduce((sum, line) => sum + Number(line.amount), 0);
    totalRevenue = roomRevenue + fbRevenue + otherRevenue;
    const activeMovement = movement.filter(
      (reservation) =>
        reservation.status !== ReservationStatus.CANCELLED &&
        reservation.status !== ReservationStatus.NO_SHOW,
    );
    const occupiedRoomIds = new Set(
      activeMovement
        .filter(
          (reservation) =>
            reservation.arrivalDate <= dateOnly && reservation.departureDate > dateOnly,
        )
        .map((reservation) => reservation.roomId)
        .filter((roomId): roomId is number => roomId !== null),
    );
    roomsOccupied = occupiedRoomIds.size;
    inHouseCount = activeMovement.filter(
      (reservation) =>
        reservation.arrivalDate <= dateOnly && reservation.departureDate > dateOnly,
    ).length;
    checkInCount = activeMovement.filter(
      (reservation) => reservation.arrivalDate >= dateOnly && reservation.arrivalDate < nextDate,
    ).length;
    checkOutCount = activeMovement.filter(
      (reservation) => reservation.departureDate >= dateOnly && reservation.departureDate < nextDate,
    ).length;
  }

  const soldRoomNights = arr.paidRoomNights;
  const occupancyRate = audit
    ? Number(audit.occupancyRate.toString())
    : safeDivide(roomsOccupied * 100, totalRooms);
  const adr = safeDivide(roomRevenue, soldRoomNights);
  const revPar = safeDivide(roomRevenue, totalRooms);
  const revPax = safeDivide(roomRevenue + fbRevenue + otherRevenue, inHouseCount);

  return {
    date,
    totalRooms,
    roomsOccupied,
    occupancyRate,
    roomRevenue,
    fbRevenue,
    otherRevenue,
    totalRevenue,
    soldRoomNights,
    adr,
    revPar,
    revPax,
    inHouseCount,
    checkInCount,
    checkOutCount,
    noShowCount,
  };
}

export function resolveManagerFlashDate(value: string | undefined) {
  return value && isValidISODateOnly(value) ? value : hotelTodayISO();
}

export async function getManagerFlashReport(selectedDate: string): Promise<ManagerFlashReport> {
  const selected = resolveManagerFlashDate(selectedDate);
  const selectedDateOnly = parseISODateOnly(selected);
  const historyDates = Array.from({ length: 14 }, (_, index) =>
    formatISODate(addDateOnlyDays(selectedDateOnly, -index)),
  );
  const firstDate = parseISODateOnly(historyDates[historyDates.length - 1]);
  const audits = await prisma.nightAudit.findMany({
    where: { businessDate: { gte: firstDate, lte: selectedDateOnly } },
    select: {
      businessDate: true,
      roomsOccupied: true,
      occupancyRate: true,
      roomRevenue: true,
      fbRevenue: true,
      otherRevenue: true,
      totalRevenue: true,
      inHouseCount: true,
      checkInCount: true,
      checkOutCount: true,
    },
  });
  const totalRooms = await prisma.room.count();
  const cutover = await getArrCutover();
  const auditByDate = new Map(audits.map((audit) => [formatISODate(audit.businessDate), audit]));
  const history = await Promise.all(
    historyDates.map((date) => calculateDay(date, totalRooms, auditByDate.get(date) ?? null, cutover)),
  );

  return { selectedDate: selected, selected: history[0], history };
}