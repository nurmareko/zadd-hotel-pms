import type { PosMenuItem, PosOrder } from "./pos-types";

export const POS_CATEGORIES = [
  { value: "all", label: "Semua" },
  { value: "main", label: "Makanan Utama" },
  { value: "beverage", label: "Minuman" },
  { value: "snack", label: "Camilan" },
  { value: "dessert", label: "Hidangan Penutup" },
];

const categoryAliases: Record<string, string> = {
  main: "main", mains: "main", "main course": "main", "main courses": "main",
  makanan: "main", "makanan utama": "main", "hidangan utama": "main",
  beverage: "beverage", beverages: "beverage", drink: "beverage", drinks: "beverage", minuman: "beverage",
  snack: "snack", snacks: "snack", camilan: "snack", cemilan: "snack", "makanan ringan": "snack",
  dessert: "dessert", desserts: "dessert", "hidangan penutup": "dessert", "makanan penutup": "dessert",
};

function normalizeCategory(category: string): string {
  const normalized = category.trim().toLowerCase().replace(/\s+/g, " ");
  return Object.hasOwn(categoryAliases, normalized) ? categoryAliases[normalized] : normalized;
}

export function filterMenuItems(items: PosMenuItem[], category: string, search: string): PosMenuItem[] {
  const selectedCategory = normalizeCategory(category);
  const query = search.trim().toLowerCase();
  return items.filter((item) =>
    (selectedCategory === "all" || normalizeCategory(item.category) === selectedCategory) &&
    item.name.toLowerCase().includes(query),
  );
}

export function selectActiveOrder(orders: PosOrder[], id: number | null): PosOrder | null {
  if (id === null) return null;
  return orders.find((order) => order.id === id && (order.status === "OPEN" || order.status === "BILLED")) ?? null;
}

export function handlePosHotkey(
  event: Pick<KeyboardEvent, "key" | "preventDefault" | "repeat" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey">,
  handlers: { newOrder: () => void; pay: () => void; sendToKitchen: () => void },
  blocked: boolean,
): void {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const handler = event.key === "F2" ? handlers.newOrder
    : event.key === "F4" ? handlers.pay
    : event.key === "F6" ? handlers.sendToKitchen
    : null;
  if (!handler) return;
  event.preventDefault();
  if (!blocked && !event.repeat) handler();
}
