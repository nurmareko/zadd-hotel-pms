import type { FoReservasiView } from "@/lib/nav-preferences";
import { FO_RESERVASI_VIEW_PATHS } from "@/lib/nav-preferences";
import { isValidISODateOnly, parseISODateOnly } from "@/lib/date-only";
import { formatISODate } from "@/lib/format";

export function getDateHref(
  view: FoReservasiView,
  startDate: Date,
  currentSearchParams: { toString(): string },
) {
  const nextSearchParams = new URLSearchParams(
    view === "list" ? currentSearchParams.toString() : "",
  );

  if (view === "list") {
    nextSearchParams.delete("startDate");
    nextSearchParams.delete("from");
    nextSearchParams.delete("to");
  } else {
    const checkIn = new URLSearchParams(currentSearchParams.toString()).get(
      "checkIn",
    );
    const calendarStartDate =
      checkIn && isValidISODateOnly(checkIn)
        ? parseISODateOnly(checkIn)
        : startDate;

    nextSearchParams.set("startDate", formatISODate(calendarStartDate));
  }

  const query = nextSearchParams.toString();
  return `${FO_RESERVASI_VIEW_PATHS[view]}${query ? `?${query}` : ""}`;
}
