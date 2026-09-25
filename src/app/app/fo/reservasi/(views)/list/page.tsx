import { flatReservationNightSummaryTotal } from "@/lib/flat-reservation-night-total";
import { computeFolioTotals } from "@/lib/folio-totals";
import { roundedFolioBalance } from "@/lib/folio-balance-display";
import { formatISODate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

import { buildReservationListWhere, parseReservationListParams } from "./query";
import { ReservationFilters } from "./reservation-filters";
import { ReservationPagination } from "./reservation-pagination";
import { ReservationTable, type ReservationGroup } from "./reservation-table";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function ReservationListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseReservationListParams(await searchParams);
  const where = buildReservationListWhere(filters);

  const totalCount = await prisma.reservation.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, filters.page), totalPages);
  const [reservations, settings] = await Promise.all([
    prisma.reservation.findMany({
      where,
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
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
      // The unique ID stabilizes page boundaries for matching dates and guest names.
      orderBy: [{ arrivalDate: "asc" }, { guest: { fullName: "asc" } }, { id: "asc" }],
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

  return (
    <section className="animate-in fade-in overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm duration-300">
      <ReservationFilters
        filters={filters}
        resultCount={totalCount}
      />
      <ReservationTable groups={groups} />
      <ReservationPagination
        filters={filters}
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        fromRow={(currentPage - 1) * PAGE_SIZE + 1}
        toRow={Math.min(currentPage * PAGE_SIZE, totalCount)}
      />
    </section>
  );
}
