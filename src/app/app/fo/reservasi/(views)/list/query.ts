import { Prisma, ReservationStatus } from "@prisma/client";

import { hotelTodayDateOnly, isValidISODateOnly, parseISODateOnly } from "@/lib/date-only";

export type ReservationListPreset = "today_arrivals" | "today_departures";

export type ReservationListFilters = {
  page: number;
  q?: string;
  status?: ReservationStatus | "ALL" | "";
  checkIn?: string;
  checkOut?: string;
  preset?: ReservationListPreset;
};

const ACTIVE_STATUSES: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
  ReservationStatus.CHECKED_OUT,
];

export function buildExportQuery(filters: ReservationListFilters): string {
  // Export includes all matching reservations, regardless of the list page.
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.status) query.set("status", filters.status);
  if (filters.checkIn) query.set("checkIn", filters.checkIn);
  if (filters.checkOut) query.set("checkOut", filters.checkOut);
  if (filters.preset) query.set("preset", filters.preset);
  return query.toString();
}

export function buildPageHref(filters: ReservationListFilters, targetPage: number): string {
  const query = new URLSearchParams(buildExportQuery(filters));
  query.set("page", targetPage.toString());
  return `/app/fo/reservasi/list?${query.toString()}`;
}

export function parseReservationListParams(
  searchParams: Record<string, string | string[] | undefined>,
): ReservationListFilters {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const status = first(searchParams.status)?.toUpperCase();
  const preset = first(searchParams.preset);
  const page = parseInt(first(searchParams.page) ?? "", 10);

  return {
    page: Number.isFinite(page) && page >= 1 ? page : 1,
    q: first(searchParams.q)?.trim() ?? "",
    status: status === "ALL"
      ? "ALL"
      : Object.values(ReservationStatus).includes(status as ReservationStatus)
        ? (status as ReservationStatus)
        : "",
    checkIn: first(searchParams.checkIn)?.trim(),
    checkOut: first(searchParams.checkOut)?.trim(),
    preset: preset === "today_arrivals" || preset === "today_departures"
      ? preset
      : undefined,
  };
}

export function buildReservationListWhere(
  filters: ReservationListFilters,
  now?: Date,
): Prisma.ReservationWhereInput {
  const where: Prisma.ReservationWhereInput = {};
  let defaultStatuses = ACTIVE_STATUSES;

  if (filters.q) {
    where.OR = [
      { reservationNo: { contains: filters.q, mode: Prisma.QueryMode.insensitive } },
      { guest: { fullName: { contains: filters.q, mode: Prisma.QueryMode.insensitive } } },
    ];
  }

  if (filters.preset === "today_arrivals") {
    where.arrivalDate = hotelTodayDateOnly(now);
    defaultStatuses = [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN];
  } else if (filters.preset === "today_departures") {
    where.departureDate = hotelTodayDateOnly(now);
    defaultStatuses = [ReservationStatus.CHECKED_IN, ReservationStatus.CHECKED_OUT];
  } else {
    if (filters.checkIn && isValidISODateOnly(filters.checkIn)) {
      where.arrivalDate = { gte: parseISODateOnly(filters.checkIn) };
    }
    if (filters.checkOut && isValidISODateOnly(filters.checkOut)) {
      where.departureDate = { lte: parseISODateOnly(filters.checkOut) };
    }
  }

  if (filters.status !== "ALL") {
    where.status = filters.status || { in: defaultStatuses };
  }

  return where;
}
