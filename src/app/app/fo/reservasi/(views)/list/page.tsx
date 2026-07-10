import { Prisma, ReservationStatus } from "@prisma/client";
import { addDays, differenceInCalendarDays, formatISO } from "date-fns";

import { todayDateOnly } from "@/lib/date-only";
import { computeFolioTotals } from "@/lib/folio-totals";
import { roundedFolioBalance } from "@/lib/folio-balance-display";
import { formatISODate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

import { ReservationFilters } from "./reservation-filters";
import { ReservationTable, type ReservationGroup } from "./reservation-table";

export const dynamic = "force-dynamic";

const DEFAULT_WINDOW_DAYS = 30;

// Default scope: reservations that are still operationally relevant.
const ACTIVE_STATUSES: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
  ReservationStatus.CHECKED_OUT,
];

type SearchParams = {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
};

function parseDateParam(value: string | undefined, today: Date) {
  if (value === "today") {
    return today;
  }

  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return undefined;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, monthIndex, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== monthIndex ||
    parsed.getUTCDate() !== day
  ) {
    return undefined;
  }

  return parsed;
}

function toDateInputValue(date: Date) {
  return formatISO(date, { representation: "date" });
}

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
  const { today } = todayDateOnly();
  const defaultToDate = addDays(today, DEFAULT_WINDOW_DAYS);
  const q = params.q?.trim() ?? "";
  const status = parseStatus(params.status);
  const fromDate =
    params.from === undefined ? today : parseDateParam(params.from, today);
  const toDate =
    params.to === undefined ? defaultToDate : parseDateParam(params.to, today);

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

  if (fromDate || toDate) {
    where.arrivalDate = {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate ? { lte: toDate } : {}),
    };
  }

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
    const nights = Math.max(
      1,
      differenceInCalendarDays(
        reservation.departureDate,
        reservation.arrivalDate,
      ),
    );
    const total = Number(reservation.rateAmount) * nights;
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
    from: fromDate ? toDateInputValue(fromDate) : "",
    to: toDate ? toDateInputValue(toDate) : "",
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
