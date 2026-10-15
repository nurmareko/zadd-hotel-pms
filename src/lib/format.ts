import { format } from "date-fns";
import { enGB as englishLocale } from "date-fns/locale";

// Keep the legacy export name for callers while rendering dates in English.
export { englishLocale, englishLocale as indonesianLocale };

export const formatIDR = (amount: number | string) =>
  `Rp ${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(Number(amount))}`;

export function formatDecimalID(
  value: number | string,
  maximumFractionDigits = 2,
) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits,
  }).format(Number(value));
}



export function formatFixedPercent(value: number | string, digits = 2) {
  return `${Number(value).toFixed(digits)}%`;
}

export function formatTimeID(date: Date) {
  return format(date, "HH:mm", { locale: englishLocale });
}

export function formatDateID(date: Date) {
  return format(date, "dd MMM yyyy", { locale: englishLocale });
}

export function formatCompactDateID(date: Date) {
  return format(date, "d MMM yyyy", { locale: englishLocale });
}

export function formatLongDateID(date: Date) {
  return format(date, "d MMMM yyyy", { locale: englishLocale });
}

export function formatDateTimeID(date: Date) {
  return format(date, "dd MMM yyyy HH:mm", { locale: englishLocale });
}

export function formatCompactDateTimeID(date: Date) {
  return format(date, "d MMM yyyy HH:mm", { locale: englishLocale });
}

export function formatLongDateTimeID(date: Date) {
  return format(date, "d MMMM yyyy HH:mm", { locale: englishLocale });
}

export function formatMonthDayTimeID(date: Date) {
  return format(date, "dd MMM HH:mm", { locale: englishLocale });
}

export function formatMonthDayID(date: Date) {
  return format(date, "dd MMM", { locale: englishLocale });
}

export function formatCompactMonthDayTimeID(date: Date) {
  return format(date, "d MMM, HH:mm", { locale: englishLocale });
}

export function formatWeekdayLongDateID(date: Date) {
  return format(date, "EEEE, d MMMM yyyy", { locale: englishLocale });
}

// Weekday + zero-padded day, e.g. "Thursday, 07 August 2025".
export function formatDateWithWeekday(date: Date) {
  return format(date, "EEEE, dd MMMM yyyy", { locale: englishLocale });
}



export function formatISODate(date: Date) {
  return format(date, "yyyy-MM-dd");
}
