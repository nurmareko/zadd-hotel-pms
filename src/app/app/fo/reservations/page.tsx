import { Prisma, ReservationStatus } from "@prisma/client";
import { addDays, formatISO } from "date-fns";
import { Plus } from "lucide-react";
import Link from "next/link";

import { todayDateOnly } from "@/lib/date-only";
import { prisma } from "@/lib/prisma";

import { ReservationFilters } from "./reservation-filters";
import { ReservationTable } from "./reservation-table";

export const dynamic = "force-dynamic";

const DEFAULT_WINDOW_DAYS = 14;
const SORT_KEYS = ["reservation_no", "arrival", "departure"] as const;
const SORT_DIRECTIONS = ["asc", "desc"] as const;

type SortKey = (typeof SORT_KEYS)[number];
type SortDirection = (typeof SORT_DIRECTIONS)[number];

type SearchParams = {
  q?: string;
  status?: string;
  type?: string;
  from?: string;
  to?: string;
  sort?: SortKey;
  dir?: SortDirection;
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

function parseSort(value: string | undefined): SortKey {
  return SORT_KEYS.some((key) => key === value) ? (value as SortKey) : "arrival";
}

function parseDirection(value: string | undefined): SortDirection {
  return SORT_DIRECTIONS.some((direction) => direction === value)
    ? (value as SortDirection)
    : "desc";
}

function parseStatus(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return Object.values(ReservationStatus).some((status) => status === value)
    ? (value as ReservationStatus)
    : undefined;
}

function buildOrderBy(
  sort: SortKey,
  dir: SortDirection,
): Prisma.ReservationOrderByWithRelationInput[] {
  if (sort === "reservation_no") {
    return [{ reservationNo: dir }, { id: "desc" }];
  }

  if (sort === "departure") {
    return [{ departureDate: dir }, { id: "desc" }];
  }

  return [{ arrivalDate: dir }, { id: "desc" }];
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
  const roomType = params.type?.trim() ?? "";
  const fromDate =
    params.from === undefined ? today : parseDateParam(params.from, today);
  const toDate =
    params.to === undefined ? defaultToDate : parseDateParam(params.to, today);
  const sort = parseSort(params.sort);
  const dir = parseDirection(params.dir);

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

  if (status) {
    where.status = status;
  }

  if (roomType) {
    where.roomType = { name: roomType };
  }

  if (fromDate || toDate) {
    where.arrivalDate = {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate ? { lte: toDate } : {}),
    };
  }

  // MVP: no pagination. Add when result sets exceed ~500.
  const [roomTypes, reservations, resultCount] = await Promise.all([
    prisma.roomType.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.reservation.findMany({
      where,
      include: {
        guest: { select: { fullName: true } },
        roomType: { select: { name: true } },
      },
      orderBy: buildOrderBy(sort, dir),
    }),
    prisma.reservation.count({ where }),
  ]);

  const filters = {
    q,
    status: status ?? ("" as const),
    type: roomType,
    from: fromDate ? toDateInputValue(fromDate) : "",
    to: toDate ? toDateInputValue(toDate) : "",
    sort,
    dir,
  };

  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
            <span className="text-console-accent">▸ </span>
            Daftar Reservasi
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            Semua reservasi aktif dan historis.
          </p>
        </div>

        <Link
          href="/app/fo/reservations/new"
          className="inline-flex h-8 items-center justify-center gap-1.5 border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Reservasi Baru
        </Link>
      </div>

      <section className="border border-console-border bg-console-surface">
        <ReservationFilters
          filters={filters}
          resultCount={resultCount}
          roomTypes={roomTypes}
        />
        <ReservationTable reservations={reservations} filters={filters} />
      </section>
    </main>
  );
}
