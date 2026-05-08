import { addDays, format } from "date-fns";

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
 * Today's calendar date is determined by the server's local timezone.
 */
export function todayDateOnly(): { today: Date; tomorrow: Date } {
  const today = dateOnlyBoundary(new Date());
  const tomorrow = addDays(today, 1);
  return { today, tomorrow };
}
