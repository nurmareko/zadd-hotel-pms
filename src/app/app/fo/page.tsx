import { ReservationStatus, RoomStatus } from "@prisma/client";
import {
  addDays,
  differenceInCalendarDays,
  startOfDay,
} from "date-fns";

// Prisma @db.Date filters require dateOnlyBoundary (UTC midnight).
// Timestamp filters (createdAt, receivedAt, etc.) use startOfDay (local midnight).
import { todayDateOnly } from "@/lib/date-only";
import { formatIDR, formatTimeID, formatWeekdayLongDateID } from "@/lib/format";
import { computeFolioTotals } from "@/lib/folio-totals";
import { prisma } from "@/lib/prisma";

import { ActivityFeed, type ActivityFeedRow } from "./activity-feed";
import { ArrivalList, type ArrivalListRow } from "./arrival-list";
import { DepartureList, type DepartureListRow } from "./departure-list";
import { KpiCard } from "./kpi-card";
import { RoomStatusCard, type RoomStatusSummaryRow } from "./room-status-card";

export const revalidate = 60;

const LIST_LIMIT = 8;
const ACTIVITY_CANDIDATE_LIMIT = 5;
const ACTIVITY_DISPLAY_LIMIT = 10;

function guestShortName(fullName: string) {
  const [firstName, ...remainingNames] = fullName.trim().split(/\s+/);
  const lastName = remainingNames.at(-1);

  if (!firstName) {
    return "Guest";
  }

  return lastName ? `${firstName} ${lastName.charAt(0)}.` : firstName;
}

function activityTimeLabel(date: Date) {
  return formatTimeID(date);
}

function todayReservationsHref(status: ReservationStatus) {
  return `/app/fo/reservations?status=${status}&from=today&to=today`;
}

async function getActivityRows(today: Date, tomorrow: Date) {
  const [checkIns, checkOuts, reservationsCreated, payments] =
    await Promise.all([
      prisma.reservation.findMany({
        where: {
          status: ReservationStatus.CHECKED_IN,
          updatedAt: { gte: today, lt: tomorrow },
        },
        include: {
          guest: { select: { fullName: true } },
          room: { select: { number: true } },
          folio: { select: { id: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: ACTIVITY_CANDIDATE_LIMIT,
      }),
      prisma.reservation.findMany({
        where: {
          status: ReservationStatus.CHECKED_OUT,
          updatedAt: { gte: today, lt: tomorrow },
        },
        include: {
          guest: { select: { fullName: true } },
          room: { select: { number: true } },
          folio: { select: { id: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: ACTIVITY_CANDIDATE_LIMIT,
      }),
      prisma.reservation.findMany({
        where: {
          createdAt: { gte: today, lt: tomorrow },
        },
        include: {
          guest: { select: { fullName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: ACTIVITY_CANDIDATE_LIMIT,
      }),
      prisma.payment.findMany({
        where: {
          receivedAt: { gte: today, lt: tomorrow },
          folioId: { not: null },
        },
        include: {
          folio: {
            select: {
              id: true,
              folioNo: true,
            },
          },
        },
        orderBy: { receivedAt: "desc" },
        take: ACTIVITY_CANDIDATE_LIMIT,
      }),
    ]);

  const rows: ActivityFeedRow[] = [
    ...checkIns.map((reservation) => ({
      id: `check-in-${reservation.id}`,
      timestamp: reservation.updatedAt,
      timeLabel: activityTimeLabel(reservation.updatedAt),
      description: `Check-in: ${guestShortName(
        reservation.guest.fullName,
      )} -> Room ${reservation.room?.number ?? "-"}`,
      href: reservation.folio
        ? `/app/fo/folios/${reservation.folio.id}`
        : `/app/fo/reservations/${reservation.id}`,
      linkLabel: reservation.folio ? "view folio" : "view",
    })),
    ...checkOuts.map((reservation) => ({
      id: `check-out-${reservation.id}`,
      timestamp: reservation.updatedAt,
      timeLabel: activityTimeLabel(reservation.updatedAt),
      description: `Check-out: ${guestShortName(
        reservation.guest.fullName,
      )} -> Room ${reservation.room?.number ?? "-"}`,
      href: reservation.folio
        ? `/app/fo/folios/${reservation.folio.id}`
        : `/app/fo/reservations/${reservation.id}`,
      linkLabel: reservation.folio ? "view folio" : "view",
    })),
    ...reservationsCreated.map((reservation) => ({
      id: `reservation-${reservation.id}`,
      timestamp: reservation.createdAt,
      timeLabel: activityTimeLabel(reservation.createdAt),
      description: `Reservation: ${guestShortName(
        reservation.guest.fullName,
      )} (${reservation.reservationNo})`,
      href: `/app/fo/reservations/${reservation.id}`,
      linkLabel: "view",
    })),
    ...payments
      .filter((payment) => payment.folio)
      .map((payment) => ({
        id: `payment-${payment.id}`,
        timestamp: payment.receivedAt,
        timeLabel: activityTimeLabel(payment.receivedAt),
        description: `Payment: ${formatIDR(
          payment.amount.toString(),
        )} - folio ${payment.folio?.folioNo ?? "-"}`,
        href: `/app/fo/folios/${payment.folio?.id}`,
        linkLabel: "view",
      })),
  ];

  return rows
    .sort(
      (first, second) =>
        second.timestamp.getTime() - first.timestamp.getTime(),
    )
    .slice(0, ACTIVITY_DISPLAY_LIMIT);
}

export default async function FODashboardPage() {
  const timestampToday = startOfDay(new Date());
  const timestampTomorrow = addDays(timestampToday, 1);
  const { today: dateOnlyToday, tomorrow: dateOnlyTomorrow } = todayDateOnly();

  const [
    inHouseCount,
    arrivalsToday,
    arrivedToday,
    departuresToday,
    rooms,
    settings,
    activityRows,
  ] = await Promise.all([
    prisma.reservation.count({
      where: {
        status: ReservationStatus.CHECKED_IN,
        arrivalDate: { lte: dateOnlyToday },
        departureDate: { gt: dateOnlyToday },
      },
    }),
    prisma.reservation.findMany({
      where: {
        status: ReservationStatus.CONFIRMED,
        arrivalDate: { gte: dateOnlyToday, lt: dateOnlyTomorrow },
      },
      include: {
        guest: { select: { fullName: true } },
        roomType: { select: { code: true, name: true } },
      },
      orderBy: { reservationNo: "asc" },
    }),
    prisma.reservation.count({
      where: {
        status: ReservationStatus.CHECKED_IN,
        arrivalDate: { gte: dateOnlyToday, lt: dateOnlyTomorrow },
      },
    }),
    prisma.reservation.findMany({
      where: {
        status: ReservationStatus.CHECKED_IN,
        departureDate: { gte: dateOnlyToday, lt: dateOnlyTomorrow },
      },
      include: {
        guest: { select: { fullName: true } },
        room: { select: { number: true } },
        folio: {
          include: {
            lineItems: {
              include: { article: true },
            },
            payments: true,
          },
        },
      },
      orderBy: { reservationNo: "asc" },
    }),
    prisma.room.findMany({ select: { status: true } }),
    prisma.hotelSettings.findUniqueOrThrow({ where: { id: 1 } }),
    getActivityRows(timestampToday, timestampTomorrow),
  ]);

  const nonOutOfOrderRooms = rooms.filter(
    (room) => room.status !== RoomStatus.OOO,
  );
  const ocCount = rooms.filter((room) => room.status === RoomStatus.OC).length;
  const availableCount = nonOutOfOrderRooms.length;
  const occupancyPercent =
    availableCount === 0 ? 0 : Math.round((ocCount / availableCount) * 100);
  const occupancySubLabel =
    availableCount === 0 && rooms.length > 0
      ? "0 kamar tersedia (semua OOO)"
      : `${ocCount} dari ${availableCount} kamar terisi`;
  const roomStatusRows: RoomStatusSummaryRow[] = [
    {
      status: RoomStatus.VC,
      label: "Vacant Clean",
      count: rooms.filter((room) => room.status === RoomStatus.VC).length,
    },
    {
      status: RoomStatus.OC,
      label: "Occupied",
      count: ocCount,
    },
    {
      status: RoomStatus.VD,
      label: "Vacant Dirty",
      count: rooms.filter((room) => room.status === RoomStatus.VD).length,
    },
    {
      status: RoomStatus.OD,
      label: "Occ. Dirty",
      count: rooms.filter((room) => room.status === RoomStatus.OD).length,
    },
    {
      status: RoomStatus.VCU,
      label: "Unchecked",
      count: rooms.filter((room) => room.status === RoomStatus.VCU).length,
    },
    {
      status: RoomStatus.OOO,
      label: "OOO",
      count: rooms.filter((room) => room.status === RoomStatus.OOO).length,
    },
  ];

  const arrivalRows: ArrivalListRow[] = arrivalsToday.map((reservation) => ({
    id: reservation.id,
    guestLabel: guestShortName(reservation.guest.fullName),
    roomTypeLabel: reservation.roomType.name,
    nights: Math.max(
      1,
      differenceInCalendarDays(
        reservation.departureDate,
        reservation.arrivalDate,
      ),
    ),
    status: reservation.status,
    reservationNo: reservation.reservationNo,
    href: `/app/fo/check-in/${reservation.id}`,
  }));

  const departureRows: DepartureListRow[] = departuresToday
    .flatMap((reservation) => {
      if (!reservation.folio) {
        console.warn(
          `FO dashboard skipped departure reservation ${reservation.id}: missing folio.`,
        );
        return [];
      }

      const totals = computeFolioTotals(
        reservation.folio.lineItems,
        reservation.folio.payments,
        settings,
      );

      return [
        {
          id: reservation.id,
          guestLabel: guestShortName(reservation.guest.fullName),
          roomLabel: `Room ${reservation.room?.number ?? "-"}`,
          folioId: reservation.folio.id,
          balance: totals.balance,
          balanceLabel: formatIDR(totals.balance),
          href: `/app/fo/check-out/${reservation.folio.id}`,
        },
      ];
    })
    .slice(0, LIST_LIMIT);

  const arrivalsHref = todayReservationsHref(ReservationStatus.CONFIRMED);
  const departuresHref = todayReservationsHref(ReservationStatus.CHECKED_IN);

  const dashboardDateLabel = formatWeekdayLongDateID(timestampToday);

  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
            <span className="text-console-accent">▸ </span>
            Dashboard Front Office
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            {dashboardDateLabel} · Shift Pagi (06:00 - 14:00)
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Arrivals Hari Ini"
          value={arrivalsToday.length}
          sub={`${arrivedToday} sudah check-in · ${arrivalsToday.length} belum`}
        />
        <KpiCard
          label="Departures Hari Ini"
          value={departuresToday.length}
          sub={`${departuresToday.length} in-house · 0 sudah check-out`}
        />
        <KpiCard
          label="In-House Guests"
          value={inHouseCount}
          sub={`${inHouseCount} tamu di hotel`}
        />
        <KpiCard
          label="Occupancy"
          value={`${occupancyPercent}%`}
          sub={occupancySubLabel}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <ArrivalList
          rows={arrivalRows.slice(0, LIST_LIMIT)}
          totalCount={arrivalRows.length}
          limit={LIST_LIMIT}
          allHref={arrivalsHref}
        />
        <div className="flex min-w-0 flex-col gap-3">
          <DepartureList
            rows={departureRows}
            totalCount={departuresToday.length}
            limit={LIST_LIMIT}
            allHref={departuresHref}
          />
          <RoomStatusCard rows={roomStatusRows} />
        </div>
      </div>

      <div className="mt-4">
        <ActivityFeed rows={activityRows} />
      </div>
    </main>
  );
}
