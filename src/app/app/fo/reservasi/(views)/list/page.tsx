import { Prisma, ReservationStatus } from "@prisma/client";
import { addDays } from "date-fns";

import { flatReservationNightSummaryTotal } from "@/lib/flat-reservation-night-total";
import { computeFolioTotals } from "@/lib/folio-totals";
import { roundedFolioBalance } from "@/lib/folio-balance-display";
import { formatISODate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

import { DAY_COUNT, parseStartDate } from "../kalender/date-window";
import { ReservationFilters } from "./reservation-filters";
import { ReservationTable, type ReservationGroup } from "./reservation-table";

export const dynamic = "force-dynamic";

// Default scope: reservations that are still operationally relevant.
const ACTIVE_STATUSES: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
  ReservationStatus.CHECKED_OUT,
];

type SearchParams = {
  q?: string;
  status?: string;
  startDate?: string | string[];
};

function parseStatus(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return Object.values(ReservationStatus).some((status) => status === value)
    ? (value as ReservationStatus)
    : undefined;
}

export default async function ReservationListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const status = parseStatus(params.status);
  const visibleStartDate = parseStartDate(params.startDate);
  const visibleEndDate = addDays(visibleStartDate, DAY_COUNT);

  const where: Prisma.ReservationWhereInput = {};

  if (q) {
    where.OR = [
      {
        reservationNo: {
          contains: q,
          mode: Prisma.QueryMode.insensitive,
        },
      },
      {
        guest: {
          fullName: {
            contains: q,
            mode: Prisma.QueryMode.insensitive,
          },
        },
      },
    ];
  }

  // Specific status narrows to one; default keeps the active set.
  where.status = status ? status : { in: ACTIVE_STATUSES };

  // Show arrivals in the same 14-day window as the Tape Chart. In-house
  // guests remain operationally relevant, so CHECKED_IN reservations bypass
  // the arrival-date window even when their stay began much earlier.
  where.AND = [
    {
      OR: [
        {
          arrivalDate: {
            gte: visibleStartDate,
            lt: visibleEndDate,
          },
        },
        { status: ReservationStatus.CHECKED_IN },
      ],
    },
  ];

  // MVP: no pagination. Add when result sets exceed ~500.
  const [reservations, settings] = await Promise.all([
    prisma.reservation.findMany({
      where,
      include: {
        guest: { select: { fullName: true } },
        room: { select: { number: true } },
        folio: {
          include: {
            lineItems: { include: { article: true } },
            payments: true,
          },
        },
      },
      // Within the list arrival is primary; guest name breaks ties inside a day.
      orderBy: [{ arrivalDate: "asc" }, { guest: { fullName: "asc" } }],
    }),
    prisma.hotelSettings.findUniqueOrThrow({ where: { id: 1 } }),
  ]);
  const reservationIds = reservations.map((reservation) => reservation.id);
  const nightlyTotals = reservationIds.length
    ? await prisma.reservationNight.groupBy({
        by: ["reservationId"],
        where: { reservationId: { in: reservationIds } },
        _count: { _all: true },
        _sum: { rateAmount: true },
        _min: { date: true },
        _max: { date: true },
      })
    : [];
  const nightlyTotalByReservationId = new Map(
    nightlyTotals.map((total) => [total.reservationId, total]),
  );
  const groupBookingIds = Array.from(
    new Set(
      reservations.flatMap((reservation) =>
        reservation.groupBookingId ? [reservation.groupBookingId] : [],
      ),
    ),
  );
  const groupCounts = groupBookingIds.length
    ? await prisma.reservation.groupBy({
        by: ["groupBookingId"],
        where: { groupBookingId: { in: groupBookingIds } },
        _count: { _all: true },
      })
    : [];
  const groupCountById = new Map(
    groupCounts.flatMap((group) =>
      group.groupBookingId
        ? [[group.groupBookingId, group._count._all] as const]
        : [],
    ),
  );

  // Group by arrival (check-in) date, ascending. Reservations already arrive
  // sorted by arrival then guest name, so groups stay in order as we build them.
  const groups: ReservationGroup[] = [];
  let currentGroup: ReservationGroup | undefined;

  for (const reservation of reservations) {
    const nightlySummary = nightlyTotalByReservationId.get(reservation.id);
    const total = Number(
      flatReservationNightSummaryTotal({
        arrivalDate: reservation.arrivalDate,
        departureDate: reservation.departureDate,
        rateAmount: reservation.rateAmount,
        summary: nightlySummary
          ? {
              count: nightlySummary._count._all,
              total: nightlySummary._sum.rateAmount,
              firstDate: nightlySummary._min.date,
              lastDate: nightlySummary._max.date,
            }
          : undefined,
      }).toString(),
    );
    const outstanding = reservation.folio
      ? roundedFolioBalance(
          computeFolioTotals(
            reservation.folio.lineItems,
            reservation.folio.payments,
            settings,
          ).balance,
        )
      : null;

    const dateKey = formatISODate(reservation.arrivalDate);

    if (!currentGroup || currentGroup.dateKey !== dateKey) {
      currentGroup = {
        dateKey,
        arrivalDate: reservation.arrivalDate,
        rows: [],
      };
      groups.push(currentGroup);
    }

    currentGroup.rows.push({
      id: reservation.id,
      reservationNo: reservation.reservationNo,
      guestName: reservation.guest.fullName,
      arrivalDate: reservation.arrivalDate,
      departureDate: reservation.departureDate,
      createdAt: reservation.createdAt,
      adults: reservation.adults,
      children: reservation.children,
      roomNumber: reservation.room?.number ?? null,
      status: reservation.status,
      total,
      outstanding,
      groupBookingId: reservation.groupBookingId,
      groupRoomCount: reservation.groupBookingId
        ? (groupCountById.get(reservation.groupBookingId) ?? 1)
        : null,
    });
  }

  const filters = {
    q,
    status: status ?? ("" as const),
    startDate: formatISODate(visibleStartDate),
  };

  return (
    <section className="animate-in fade-in overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm duration-300">
      <ReservationFilters
        filters={filters}
        resultCount={reservations.length}
      />
      <ReservationTable groups={groups} />
    </section>
  );
}
