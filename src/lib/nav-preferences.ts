export const NAV_SIDEBAR_COLLAPSED_COOKIE = "zadd_sidebar_collapsed";

export const FO_RESERVASI_VIEW_COOKIE = "zadd_fo_reservasi_view";

export type FoReservasiView = "kalender" | "list";

export const FO_RESERVASI_VIEW_PATHS: Record<FoReservasiView, string> = {
  kalender: "/app/fo/reservasi/kalender",
  list: "/app/fo/reservasi/list",
};

export function parseFoReservasiView(
  value: string | string[] | undefined,
): FoReservasiView | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;

  return candidate === "kalender" || candidate === "list"
    ? candidate
    : undefined;
}
