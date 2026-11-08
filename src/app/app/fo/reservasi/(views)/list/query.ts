import { DepositStatus, Prisma, ReservationStatus, ReservationType } from "@prisma/client";

import { hotelTodayDateOnly, isValidISODateOnly, parseISODateOnly } from "@/lib/date-only";

const VALID_PRESETS = ["today_arrivals", "today_departures", "in_house"] as const;
export type ReservationListPreset = typeof VALID_PRESETS[number];

export type ReservationListFilters = {
  page: number;
  q?: string;
  status?: ReservationStatus | "ALL" | "";
  depositStatus?: DepositStatus | "ALL";
  reservationType?: ReservationType | "ALL";
  roomTypeId?: number | "ALL";
  checkIn?: string;
  checkOut?: string;
  preset?: ReservationListPreset;
  sort?: "newest" | "arrival";
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
  if (filters.depositStatus) query.set("depositStatus", filters.depositStatus);
  if (filters.reservationType) query.set("reservationType", filters.reservationType);
  if (filters.roomTypeId !== undefined) query.set("roomTypeId", String(filters.roomTypeId));
  if (filters.checkIn) query.set("checkIn", filters.checkIn);
  if (filters.checkOut) query.set("checkOut", filters.checkOut);
  if (filters.preset) query.set("preset", filters.preset);
  return query.toString();
}

export function buildPageHref(filters: ReservationListFilters, targetPage: number): string {
  const query = new URLSearchParams(buildExportQuery(filters));
  if (filters.sort) query.set("sort", filters.sort);
  query.set("page", targetPage.toString());
  return `/app/fo/reservasi/list?${query.toString()}`;
}

export function parseReservationListParams(
  searchParams: Record<string, string | string[] | undefined>,
): ReservationListFilters {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const status = first(searchParams.status)?.toUpperCase();
  const depositStatus = first(searchParams.depositStatus)?.toUpperCase();
  const reservationType = (first(searchParams.reservationType) ?? first(searchParams.type))?.toUpperCase();
  const rawRoomTypeId = first(searchParams.roomTypeId);
  const roomTypeId = rawRoomTypeId && /^\d+$/.test(rawRoomTypeId) ? Number(rawRoomTypeId) : NaN;
  const rawPreset = first(searchParams.preset);
  const preset = VALID_PRESETS.includes(rawPreset as ReservationListPreset)
    ? rawPreset as ReservationListPreset
    : undefined;
  const sort = first(searchParams.sort);
  const page = parseInt(first(searchParams.page) ?? "", 10);

  return {
    page: Number.isFinite(page) && page >= 1 ? page : 1,
    q: first(searchParams.q)?.trim() ?? "",
    status: status === "ALL"
      ? "ALL"
      : Object.values(ReservationStatus).includes(status as ReservationStatus)
        ? (status as ReservationStatus)
        : "",
    depositStatus: depositStatus === "ALL"
      ? "ALL"
      : Object.values(DepositStatus).includes(depositStatus as DepositStatus)
        ? (depositStatus as DepositStatus)
        : undefined,
    reservationType: reservationType === "ALL"
      ? "ALL"
      : Object.values(ReservationType).includes(reservationType as ReservationType)
        ? (reservationType as ReservationType)
        : undefined,
    roomTypeId: rawRoomTypeId === "ALL"
      ? "ALL"
      // Prisma Int maps to a signed 32-bit PostgreSQL integer.
      : Number.isSafeInteger(roomTypeId) && roomTypeId > 0 && roomTypeId <= 2147483647
        ? roomTypeId
        : undefined,
    checkIn: first(searchParams.checkIn)?.trim(),
    checkOut: first(searchParams.checkOut)?.trim(),
    preset,
    sort: sort === "newest" || sort === "arrival"
      ? sort
      : preset === "today_arrivals" || preset === "today_departures"
        ? "arrival"
        : "newest",
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
      { room: { number: { contains: filters.q, mode: Prisma.QueryMode.insensitive } } },
    ];
  }

  if (filters.preset === "today_arrivals") {
    where.arrivalDate = hotelTodayDateOnly(now);
    defaultStatuses = [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN];
  } else if (filters.preset === "today_departures") {
    where.departureDate = hotelTodayDateOnly(now);
    defaultStatuses = [ReservationStatus.CHECKED_IN, ReservationStatus.CHECKED_OUT];
  } else if (filters.preset !== "in_house") {
    if (filters.checkIn && isValidISODateOnly(filters.checkIn)) {
      where.arrivalDate = { gte: parseISODateOnly(filters.checkIn) };
    }
    if (filters.checkOut && isValidISODateOnly(filters.checkOut)) {
      where.departureDate = { lte: parseISODateOnly(filters.checkOut) };
    }
  }

  if (filters.preset === "in_house") {
    where.status = ReservationStatus.CHECKED_IN;
  } else if (filters.status !== "ALL") {
    where.status = filters.status || { in: defaultStatuses };
  }

  if (filters.depositStatus && filters.depositStatus !== "ALL") {
    where.depositStatus = filters.depositStatus;
  }

  if (filters.reservationType && filters.reservationType !== "ALL") {
    where.reservationType = filters.reservationType;
  }
  if (filters.roomTypeId !== undefined && filters.roomTypeId !== "ALL") {
    where.roomTypeId = filters.roomTypeId;
  }

  return where;
}
