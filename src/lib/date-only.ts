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
