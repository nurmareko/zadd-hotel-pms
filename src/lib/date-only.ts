import { addDays, format } from "date-fns";

/**
 * The hotel's operating timezone. All "today" computations must resolve to this
 * zone, not the server clock (Vercel runs in UTC).
 */
const HOTEL_TIME_ZONE = "Asia/Jakarta";

/**
 * Today's calendar date in the hotel timezone (Asia/Jakarta / WIB, UTC+7) as a
 * "YYYY-MM-DD" string. The timezone is resolved explicitly via Intl, so the
 * result is correct regardless of the server's timezone — relying on the server
 * clock anchors "today" on the UTC date, which lags WIB by up to 7 hours.
 *
 * Example: at 00:40 WIB on June 1 (= 2026-05-31T17:40:00Z) this returns
 * "2026-06-01", whereas the raw UTC server clock still reads "2026-05-31".
 */
export function hotelTodayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: HOTEL_TIME_ZONE,
  }).format(now);
}

/**
 * Today's date in the hotel timezone as a UTC-midnight date-only Date — the same
 * shape `dateOnlyBoundary()` produces, suitable for Prisma @db.Date queries.
 */
export function hotelTodayDateOnly(now: Date = new Date()): Date {
  return new Date(`${hotelTodayISO(now)}T00:00:00.000Z`);
}

/**
 * Offset (in ms) of the hotel timezone relative to UTC at the given instant
 * (zone − UTC; +7h for WIB). Derived via Intl rather than hardcoded so it stays
 * correct if the zone definition ever changes; Asia/Jakarta has no DST today.
 */
function hotelOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: HOTEL_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);

  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  const wallClockAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );

  return wallClockAsUtc - at.getTime();
}

/**
 * UTC timestamps bounding the hotel's current WIB day, as a half-open window
 * [start, end) for filtering timestamp columns (createdAt, receivedAt, …).
 *
 * `start` is WIB midnight today expressed in UTC. Asia/Jakarta is a fixed UTC+7
 * with no DST, so the day is exactly 24h. Example: at 00:30 WIB on June 1
 * (= 2026-05-31T17:30:00Z) `start` is 2026-05-31T17:00:00Z and `end` is
 * 2026-06-01T17:00:00Z — so a 00:30 record falls in June 1's window, not May 31's,
 * and a 23:30 May 31 WIB record (= 16:30Z) stays in May 31's window.
 */
export function hotelTodayTimestampRange(now: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const offsetMs = hotelOffsetMs(now);
  const start = new Date(
    new Date(`${hotelTodayISO(now)}T00:00:00.000Z`).getTime() - offsetMs,
  );
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return { start, end };
}

/**
 * UTC timestamp for midnight at the start of a hotel-local ISO calendar date.
 * Use this for timestamp columns when a user picks a specific YYYY-MM-DD date.
 */
export function hotelTimestampBoundaryForDate(isoDate: string): Date {
  const reference = new Date(`${isoDate}T00:00:00.000Z`);
  const offsetMs = hotelOffsetMs(reference);

  return new Date(reference.getTime() - offsetMs);
}

/**
 * Convert a local Date to a UTC-midnight Date representing the same calendar date.
 * Use this for queries against Prisma @db.Date columns to avoid timezone drift.
 *
 * Example:
 *   In WIB (UTC+7), `new Date()` at 9am local on May 8 prints as 2026-05-08T02:00:00Z.
 *   `startOfDay(new Date())` returns 2026-05-08T00:00:00 LOCAL = 2026-05-07T17:00:00Z.
 *   Comparing this against an @db.Date value of 2026-05-08 fails.
 *   `dateOnlyBoundary(new Date())` returns 2026-05-08T00:00:00Z, which Prisma compares correctly.
 */
export function dateOnlyBoundary(date: Date): Date {
  const localDateStr = format(date, "yyyy-MM-dd");
  return new Date(`${localDateStr}T00:00:00.000Z`);
}

/**
 * Get UTC-midnight representations of "today" and "tomorrow" for date-only Prisma queries.
 * Today's calendar date is resolved in the hotel timezone (Asia/Jakarta) via
 * `hotelTodayDateOnly()`, not the server clock.
 */
export function todayDateOnly(): { today: Date; tomorrow: Date } {
  const today = hotelTodayDateOnly();
  const tomorrow = addDays(today, 1);
  return { today, tomorrow };
}
