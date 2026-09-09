import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";

import { indonesianLocale } from "@/lib/format";

import { DAY_COUNT } from "./date-window";

export const WEEKDAY_LABELS = [
  "Sen",
  "Sel",
  "Rab",
  "Kam",
  "Jum",
  "Sab",
  "Min",
] as const;

export function buildCalendarDays(displayMonth: Date) {
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(displayMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(displayMonth), { weekStartsOn: 1 }),
  });
}

export function formatCalendarMonthTitle(displayMonth: Date) {
  return format(displayMonth, "MMMM yyyy", { locale: indonesianLocale });
}

export function isDateInVisibleWindow(date: Date, visibleStartDate: Date) {
  const candidate = startOfDay(date);
  const start = startOfDay(visibleStartDate);

  return !isBefore(candidate, start) && isBefore(candidate, addDays(start, DAY_COUNT));
}
