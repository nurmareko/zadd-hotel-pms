import type { FoReservasiView } from "@/lib/nav-preferences";
import { FO_RESERVASI_VIEW_PATHS } from "@/lib/nav-preferences";
import { formatISODate } from "@/lib/format";

export function getDateHref(
  view: FoReservasiView,
  startDate: Date,
  currentSearchParams: { toString(): string },
) {
  const nextSearchParams = new URLSearchParams(
    view === "list" ? currentSearchParams.toString() : "",
  );
  nextSearchParams.set("startDate", formatISODate(startDate));
  nextSearchParams.delete("from");
  nextSearchParams.delete("to");

  return `${FO_RESERVASI_VIEW_PATHS[view]}?${nextSearchParams.toString()}`;
}
