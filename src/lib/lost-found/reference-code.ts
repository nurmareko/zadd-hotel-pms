import { hotelTimestampBoundaryForDate, hotelTodayISO } from "@/lib/date-only";

export function getLostFoundCodeMonth(now: Date = new Date()) {
  const iso = hotelTodayISO(now);
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return {
    prefix: `LF-${iso.slice(2, 4)}${iso.slice(5, 7)}-`,
    start: hotelTimestampBoundaryForDate(`${iso.slice(0, 7)}-01`),
    end: hotelTimestampBoundaryForDate(nextMonth),
  };
}

/** count is the number already allocated; padding is a minimum, not a limit. */
export function generateLostFoundReferenceCode(now: Date, count: number): string {
  if (!Number.isSafeInteger(count) || count < 0 || count >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError("Nomor referensi barang temuan tidak valid atau telah mencapai batas.");
  }
  return `${getLostFoundCodeMonth(now).prefix}${String(count + 1).padStart(4, "0")}`;
}
