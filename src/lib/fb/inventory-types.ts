export type InventoryIngredient = {
  id: number;
  name: string;
  category: string;
  unit: string;
  onHand: number;
  parLevel: number;
  location: string | null;
  lastCountedAt: string | null;
  menuItem: { id: number; name: string; isActive: boolean } | null;
};

export type InventoryMovement = {
  id: number;
  type: "RECEIVE" | "STOCK_TAKE" | "WASTAGE" | "CONSUMPTION";
  quantityDelta: number;
  balanceAfter: number;
  notes: string | null;
  createdAt: string;
  recordedBy: string;
};

export function deriveInventoryStatus(
  onHand: number,
  parLevel: number,
): "NEGATIVE" | "OUT" | "LOW" | "OK" {
  if (onHand < 0) return "NEGATIVE";
  if (onHand === 0) return "OUT";
  if (onHand <= parLevel) return "LOW";
  return "OK";
}
