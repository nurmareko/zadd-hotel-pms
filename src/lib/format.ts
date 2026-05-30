import { format } from "date-fns";
import { id as indonesianLocale } from "date-fns/locale";

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

export function formatPercentID(value: number | string) {
  return `${formatDecimalID(value)}%`;
}

export function formatFixedPercent(value: number | string, digits = 2) {
  return `${Number(value).toFixed(digits)}%`;
}

export function formatTimeID(date: Date) {
  return format(date, "HH:mm", { locale: indonesianLocale });
}

export function formatDateID(date: Date) {
  return format(date, "dd MMM yyyy", { locale: indonesianLocale });
}

export function formatCompactDateID(date: Date) {
  return format(date, "d MMM yyyy", { locale: indonesianLocale });
}

export function formatLongDateID(date: Date) {
  return format(date, "d MMMM yyyy", { locale: indonesianLocale });
}

export function formatDateTimeID(date: Date) {
  return format(date, "dd MMM yyyy HH:mm", { locale: indonesianLocale });
}

export function formatCompactDateTimeID(date: Date) {
  return format(date, "d MMM yyyy HH:mm", { locale: indonesianLocale });
}

export function formatLongDateTimeID(date: Date) {
  return format(date, "d MMMM yyyy HH:mm", { locale: indonesianLocale });
}

export function formatMonthDayTimeID(date: Date) {
  return format(date, "dd MMM HH:mm", { locale: indonesianLocale });
}

export function formatMonthDayID(date: Date) {
  return format(date, "dd MMM", { locale: indonesianLocale });
}

export function formatCompactMonthDayTimeID(date: Date) {
  return format(date, "d MMM, HH:mm", { locale: indonesianLocale });
}

export function formatWeekdayLongDateID(date: Date) {
  return format(date, "EEEE, d MMMM yyyy", { locale: indonesianLocale });
}

// Weekday + zero-padded day, e.g. "Kamis, 07 Agustus 2025".
export function formatDateWithWeekday(date: Date) {
  return format(date, "EEEE, dd MMMM yyyy", { locale: indonesianLocale });
}

export function formatDayOfMonthID(date: Date) {
  return format(date, "d", { locale: indonesianLocale });
}

export function formatISODate(date: Date) {
  return format(date, "yyyy-MM-dd");
}
