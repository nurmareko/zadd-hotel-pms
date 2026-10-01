export const KITCHEN_STATIONS = ["ALL", "KITCHEN", "BAR", "GRILL", "FRYER"] as const;

export type KitchenStation = (typeof KITCHEN_STATIONS)[number];

export const KITCHEN_STATION_LABELS: Record<KitchenStation, string> = {
  ALL: "Semua",
  KITCHEN: "Dapur",
  BAR: "Bar",
  GRILL: "Panggangan",
  FRYER: "Gorengan",
};

const BAR_WORDS = /\b(?:beverages?|drinks?|minuman|kopi|teh|juice|water)\b/i;
const GRILL_WORDS = /\b(?:grill|bbq|bakar|sate|steak)\b/i;
const FRYER_WORDS = /\b(?:fryer|goreng|snacks|fries|crispy)\b/i;

export function resolveItemStation(
  category?: string | null,
  name?: string | null,
): Exclude<KitchenStation, "ALL"> {
  const text = `${category ?? ""} ${name ?? ""}`;

  // Station priority applies across both fields, not category before name.
  if (BAR_WORDS.test(text)) return "BAR";
  if (GRILL_WORDS.test(text)) return "GRILL";
  if (FRYER_WORDS.test(text)) return "FRYER";
  return "KITCHEN";
}

export function filterTicketsByStation<
  T extends { items: readonly { category?: string | null; name?: string | null }[] },
>(tickets: readonly T[], station: KitchenStation): T[] {
  return tickets.filter(
    (ticket) => station === "ALL" || ticket.items.some(
      (item) => resolveItemStation(item.category, item.name) === station,
    ),
  );
}
