import {
  ArticleType,
  FBOrderStatus,
  ReservationStatus,
  ReservationType,
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
import { ROOM_CHARGE_ARTICLE_CODE } from "@/lib/stay-charges";

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
  bookingSources: BookingSourceContribution[];
};

export type BookingSourceContribution = {
  source: ReservationType | "UNKNOWN";
  revenue: number;
  reservationCount: number;
  roomNights: number;
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

const bookingSourceOrder: Array<ReservationType | "UNKNOWN"> = [
  ReservationType.INDIVIDUAL,
  ReservationType.COMPANY,
  ReservationType.GOVERNMENT,
  ReservationType.OTA,
  ReservationType.WALK_IN,
  "UNKNOWN",
];

async function getBookingSourceContributions(
  date: string,
): Promise<BookingSourceContribution[]> {
  const dateOnly = parseISODateOnly(date);
  const nextDate = addDateOnlyDays(dateOnly, 1);
  const { start, end } = dayRange(date);
  const [reservations, stayLineItems, otherLineItems, closedFbOrders] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        reservationNights: { some: { date: dateOnly } },
        status: { notIn: [ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW] },
      },
      select: {
        id: true,
        reservationType: true,
        reservationNights: { where: { date: dateOnly }, select: { id: true } },
      },
    }),
    prisma.folioLineItem.findMany({
      where: {
        reservationNight: { date: { gte: dateOnly, lt: nextDate } },
        fbOrderId: null,
      },
      select: {
        amount: true,
        folio: { select: { reservation: { select: { reservationType: true } } } },
      },
    }),
    prisma.folioLineItem.findMany({
      where: {
        postedAt: { gte: start, lt: end },
        fbOrderId: null,
        reservationNightId: null,
      },
      select: {
        amount: true,
        folio: { select: { reservation: { select: { reservationType: true } } } },
      },
    }),
    prisma.fBOrder.findMany({
      where: { status: FBOrderStatus.CLOSED, closedAt: { gte: start, lt: end } },
      select: {
        total: true,
        chargedFolio: {
          select: { reservation: { select: { reservationType: true } } },
        },
      },
    }),
  ]);

  const rows = new Map(
    bookingSourceOrder.map((source) => [
      source,
      { source, revenue: 0, reservationIds: new Set<number>(), roomNights: 0 },
    ]),
  );
  const sourceFor = (source: ReservationType | null | undefined) => source ?? "UNKNOWN";

  for (const reservation of reservations) {
    const row = rows.get(sourceFor(reservation.reservationType));
    row?.reservationIds.add(reservation.id);
    if (row) row.roomNights += reservation.reservationNights.length;
  }

  for (const line of [...stayLineItems, ...otherLineItems]) {
    const row = rows.get(sourceFor(line.folio.reservation.reservationType));
    if (row) row.revenue += Number(line.amount ?? 0);
  }

  for (const order of closedFbOrders) {
    const row = rows.get(sourceFor(order.chargedFolio?.reservation.reservationType));
    if (row) row.revenue += Number(order.total ?? 0);
  }

  return bookingSourceOrder
    .map((source) => {
      const row = rows.get(source);
      return {
        source,
        revenue: row?.revenue ?? 0,
        reservationCount: row?.reservationIds.size ?? 0,
        roomNights: row?.roomNights ?? 0,
      };
    })
    .filter((row) => row.revenue !== 0 || row.reservationCount !== 0 || row.roomNights !== 0);
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
  includeBookingSources = false,
): Promise<ManagerFlashDay> {
  const dateOnly = parseISODateOnly(date);
  const nextDate = addDateOnlyDays(dateOnly, 1);
  const { start, end } = dayRange(date);
  const [arr, movement, noShowCount, bookingSources] = await Promise.all([
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
    includeBookingSources
      ? getBookingSourceContributions(date)
      : Promise.resolve([] as BookingSourceContribution[]),
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
    const [stayLineItems, otherLineItems, closedFbRevenue] = await Promise.all([
      prisma.folioLineItem.findMany({
        where: {
          reservationNight: { date: { gte: dateOnly, lt: nextDate } },
          fbOrderId: null,
        },
        select: { amount: true, article: { select: { code: true, type: true } } },
      }),
      prisma.folioLineItem.findMany({
        where: {
          postedAt: { gte: start, lt: end },
          fbOrderId: null,
          reservationNightId: null,
        },
        select: { amount: true, article: { select: { type: true } } },
      }),
      prisma.fBOrder.aggregate({
        where: { status: FBOrderStatus.CLOSED, closedAt: { gte: start, lt: end } },
        _sum: { total: true },
      }),
    ]);
    roomRevenue = stayLineItems
      .filter((line) => line.article.code === ROOM_CHARGE_ARTICLE_CODE)
      .reduce((sum, line) => sum + Number(line.amount), 0);
    const inclusionRevenue = stayLineItems
      .filter((line) => line.article.type === ArticleType.FB)
      .reduce((sum, line) => sum + Number(line.amount), 0);
    fbRevenue = inclusionRevenue + Number(closedFbRevenue._sum.total ?? 0);
    otherRevenue = otherLineItems
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
  const adr = arr.arr ? Number(arr.arr.toString()) : 0;
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
    bookingSources,
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
    historyDates.map((date, index) =>
      calculateDay(
        date,
        totalRooms,
        auditByDate.get(date) ?? null,
        cutover,
        index === 0,
      ),
    ),
  );

  return { selectedDate: selected, selected: history[0], history };
}