import { Prisma, ReservationStatus } from "@prisma/client";
import { addDays, differenceInCalendarDays, formatISO } from "date-fns";
import { Plus } from "lucide-react";
import Link from "next/link";

import { todayDateOnly } from "@/lib/date-only";
import { computeFolioTotals } from "@/lib/folio-totals";
import { roundedFolioBalance } from "@/lib/folio-balance-display";
import { formatISODate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

import { ReservationViewToggle } from "../reservation-view-toggle";
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
    });
  }

  const filters = {
    q,
    status: status ?? ("" as const),
    from: fromDate ? toDateInputValue(fromDate) : "",
    to: toDate ? toDateInputValue(toDate) : "",
  };

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-4 text-slate-900 md:px-6 md:py-5">
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Daftar Reservasi
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Dikelompokkan menurut tanggal check-in.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ReservationViewToggle currentView="list" />
          <Link
            href="/app/fo/reservasi/new?from=list"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Tambah Reservasi
          </Link>
        </div>
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <ReservationFilters
          filters={filters}
          resultCount={reservations.length}
        />
        <ReservationTable groups={groups} />
      </section>
    </main>
  );
}
