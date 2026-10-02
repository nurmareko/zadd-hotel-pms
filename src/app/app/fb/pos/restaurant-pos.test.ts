import { describe, expect, it, vi } from "vitest";
import { filterMenuItems, handlePosHotkey, POS_CATEGORIES, selectActiveOrder } from "./pos-state";
import type { PosMenuItem, PosOrder } from "./pos-types";

function menuItem(category: string, id = 1, name = "Nasi Goreng"): PosMenuItem {
  return { id, name, category, price: "65000" };
}

function order(id: number, status: PosOrder["status"] = "OPEN"): PosOrder {
  return {
    id, orderNo: `KOT-${id}`, tableId: id, serviceType: "DINE_IN", status,
    destination: `Meja ${id}`, guestCount: 2, waiterName: "Sari",
    kitchenStartedAt: null, kitchenReadyAt: null, items: [],
    totals: { subtotal: "10000", serviceCharge: "1000", tax: "1100", total: "12100" },
    attachedRoomFolio: null,
  };
}

describe("filterMenuItems", () => {
  it("exports the five stable categories with Indonesian labels", () => {
    expect(POS_CATEGORIES).toEqual([
      { value: "all", label: "Semua" },
      { value: "main", label: "Makanan Utama" },
      { value: "beverage", label: "Minuman" },
      { value: "snack", label: "Camilan" },
      { value: "dessert", label: "Hidangan Penutup" },
    ]);
  });

  it.each([
    ["Main", "main"], ["Mains", "main"], [" Main Course ", "main"],
    ["MAIN COURSES", "main"], ["Makanan", "main"], ["Makanan Utama", "main"],
    ["Hidangan Utama", "main"], ["Beverage", "beverage"], ["Beverages", "beverage"],
    ["Drink", "beverage"], ["Drinks", "beverage"], ["Minuman", "beverage"],
    ["Snack", "snack"], ["Snacks", "snack"], ["Camilan", "snack"],
    ["Cemilan", "snack"], ["Makanan Ringan", "snack"],
    ["Dessert", "dessert"], ["Desserts", "dessert"], ["Hidangan Penutup", "dessert"],
    ["Makanan Penutup", "dessert"],
  ])("normalizes %s into %s", (legacy, category) => {
    const item = menuItem(legacy);
    expect(filterMenuItems([item], category, "")).toEqual([item]);
  });

  it("combines a category filter with trimmed case-insensitive name search", () => {
    const nasi = menuItem("Mains");
    const items = [nasi, menuItem("Mains", 2, "Mie Goreng"), menuItem("Snack", 3, "Nasi Mini")];
    expect(filterMenuItems(items, "main", "  NASI  ")).toEqual([nasi]);
    expect(items).toHaveLength(3);
  });

  it("keeps unknown categories available in all without misclassifying them", () => {
    const breakfast = menuItem("Breakfast", 1, "Omelette");
    const other = menuItem("Paket Spesial", 2, "Paket Keluarga");
    expect(filterMenuItems([breakfast, other], "all", "")).toEqual([breakfast, other]);
    expect(filterMenuItems([breakfast, other], "all", "OMELETTE")).toEqual([breakfast]);
    expect(filterMenuItems([breakfast, other], "main", "")).toEqual([]);
  });

  it("handles empty input and no search matches", () => {
    expect(filterMenuItems([], "all", "")).toEqual([]);
    expect(filterMenuItems([menuItem("Mains")], "all", "kopi")).toEqual([]);
  });
});

describe("selectActiveOrder", () => {
  it("switches to the exact requested order without mixing its data", () => {
    const first = order(1);
    const second = order(2, "BILLED");
    const orders = [first, second];
    expect(selectActiveOrder(orders, 1)).toBe(first);
    expect(selectActiveOrder(orders, 2)).toBe(second);
    expect(selectActiveOrder(orders, 1)).toBe(first);
  });

  it("does not fall back when selection is null, missing, or removed", () => {
    expect(selectActiveOrder([order(1)], null)).toBeNull();
    expect(selectActiveOrder([order(1)], 2)).toBeNull();
    expect(selectActiveOrder([], 1)).toBeNull();
  });

  it.each(["CLOSED", "VOIDED"] as const)("clears a %s selection even if another open order exists", (status) => {
    expect(selectActiveOrder([order(1, status), order(2)], 1)).toBeNull();
  });
});

describe("handlePosHotkey", () => {
  function setup(key: string, overrides: Partial<Parameters<typeof handlePosHotkey>[0]> = {}) {
    return {
      event: { key, preventDefault: vi.fn(), repeat: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...overrides },
      handlers: { newOrder: vi.fn(), pay: vi.fn(), sendToKitchen: vi.fn() },
    };
  }

  it.each([["F2", "newOrder"], ["F4", "pay"], ["F6", "sendToKitchen"]] as const)("prevents the default and dispatches %s only to %s", (key, handler) => {
    const { event, handlers } = setup(key);
    handlePosHotkey(event, handlers, false);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    for (const name of Object.keys(handlers) as (keyof typeof handlers)[]) {
      expect(handlers[name]).toHaveBeenCalledTimes(name === handler ? 1 : 0);
    }
  });

  it.each(["F2", "F4", "F6"])("still prevents %s while blocked or repeating, without an action", (key) => {
    for (const [blocked, repeat] of [[true, false], [false, true], [true, true]]) {
      const { event, handlers } = setup(key, { repeat });
      handlePosHotkey(event, handlers, blocked);
      expect(event.preventDefault).toHaveBeenCalledOnce();
      for (const handler of Object.values(handlers)) expect(handler).not.toHaveBeenCalled();
    }
  });

  it.each(["altKey", "ctrlKey", "metaKey", "shiftKey"] as const)("ignores modified shortcuts with %s", (modifier) => {
    for (const key of ["F2", "F4", "F6"]) {
      const { event, handlers } = setup(key, { [modifier]: true });
      handlePosHotkey(event, handlers, false);
      expect(event.preventDefault).not.toHaveBeenCalled();
      for (const handler of Object.values(handlers)) expect(handler).not.toHaveBeenCalled();
    }
  });

  it("leaves unrelated keys alone", () => {
    const { event, handlers } = setup("Enter");
    handlePosHotkey(event, handlers, false);
    expect(event.preventDefault).not.toHaveBeenCalled();
    for (const handler of Object.values(handlers)) expect(handler).not.toHaveBeenCalled();
  });
});
