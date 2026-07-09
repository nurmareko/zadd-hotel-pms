import { addDays, isValid, parseISO } from "date-fns";

import { dateOnlyBoundary, hotelTodayDateOnly } from "@/lib/date-only";
import { formatDateID, formatISODate, formatMonthDayID } from "@/lib/format";

// Shared between the kalender page (server) and the persistent view header
// (client) so both derive the same visible window from ?startDate.
export const DAY_COUNT = 14;
const DEFAULT_PAST_DAY_COUNT = 2;

export function getDefaultStartDate() {
  // Anchor the default window on the hotel timezone "today" so TODAY lands at
  // column index DEFAULT_PAST_DAY_COUNT (2) instead of the UTC server date.
  return addDays(hotelTodayDateOnly(), -DEFAULT_PAST_DAY_COUNT);
}

export function parseStartDate(value: string | string[] | undefined | null) {
  const candidate = Array.isArray(value) ? value[0] : value;
  const defaultStartDate = getDefaultStartDate();

  if (!candidate || !/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
    return defaultStartDate;
  }

  const parsed = parseISO(candidate);

  return isValid(parsed) ? dateOnlyBoundary(parsed) : defaultStartDate;
}

export function getDateHref(startDate: Date) {
  return `/app/fo/reservasi/kalender?startDate=${formatISODate(startDate)}`;
}

export function buildRangeLabel(startDate: Date) {
  return `${formatMonthDayID(startDate)} - ${formatDateID(
    addDays(startDate, DAY_COUNT - 1),
  )}`;
}
