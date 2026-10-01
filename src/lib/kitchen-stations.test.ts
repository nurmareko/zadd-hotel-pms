import { describe, expect, expectTypeOf, it } from "vitest";

import {
  filterTicketsByStation,
  KITCHEN_STATION_LABELS,
  KITCHEN_STATIONS,
  type KitchenStation,
  resolveItemStation,
} from "./kitchen-stations";

describe("kitchen station definitions", () => {
  it("exports the stations in display order with Indonesian labels", () => {
    expect(KITCHEN_STATIONS).toEqual(["ALL", "KITCHEN", "BAR", "GRILL", "FRYER"]);
    expect(KITCHEN_STATION_LABELS).toEqual({
      ALL: "Semua",
      KITCHEN: "Dapur",
      BAR: "Bar",
      GRILL: "Panggangan",
      FRYER: "Gorengan",
    });
    expectTypeOf<KitchenStation>().toEqualTypeOf<
      "ALL" | "KITCHEN" | "BAR" | "GRILL" | "FRYER"
    >();
  });
});

describe("resolveItemStation", () => {
  const keywords = [
    ["BAR", ["Beverage", "Beverages", "Drink", "Drinks", "Minuman", "Kopi", "Teh", "Juice", "Water"]],
    ["GRILL", ["Grill", "BBQ", "Bakar", "Sate", "Steak"]],
    ["FRYER", ["Fryer", "Goreng", "Snacks", "Fries", "Crispy"]],
  ] as const;

  for (const [station, words] of keywords) {
    describe(station, () => {
      it.each(words)("matches %s in either field, regardless of case", (word) => {
        expect(resolveItemStation(word.toLowerCase(), null)).toBe(station);
        expect(resolveItemStation(undefined, word.toUpperCase())).toBe(station);
        expect(resolveItemStation(`Special ${word} Menu`, "Unknown")).toBe(station);
        expect(resolveItemStation("Unknown", `Special ${word} Menu`)).toBe(station);
      });
    });
  }

  it.each([
    ["(teh)", "BAR"],
    ["fresh-juice", "BAR"],
    ["BBQ/ayam", "GRILL"],
    ["ayam\nbakar", "GRILL"],
    ["nasi\tgoreng", "FRYER"],
    ["  Crispy!  ", "FRYER"],
  ] as const)("recognizes word boundaries in %s", (name, station) => {
    expect(resolveItemStation(null, name)).toBe(station);
  });

  it.each([
    "Watermelon", "Satay", "Drinkable", "BeveragesExtra", "Kopiko",
    "Tehran", "Juicer", "Grilled", "BBQsauce", "Kebakaran", "Satelite",
    "Steakhouse", "Fryers", "Gorengan", "SnacksExtra", "FriesExtra",
    "Crispyish", "Underwater", "xteh", "water2", "water_special",
  ])("does not match a keyword embedded in %s", (word) => {
    expect(resolveItemStation(word, word)).toBe("KITCHEN");
  });

  it.each([
    [undefined, undefined], [null, null], ["", ""], [" \t", "\n"],
    ["Makanan", "Sup Ayam"], [null, "Watermelon Satay"],
  ])("falls back for category %s and name %s", (category, name) => {
    expect(resolveItemStation(category, name)).toBe("KITCHEN");
  });

  it("allows both arguments to be omitted and never returns ALL", () => {
    expect(resolveItemStation()).toBe("KITCHEN");
    expectTypeOf(resolveItemStation()).toEqualTypeOf<Exclude<KitchenStation, "ALL">>();
  });

  it.each([
    ["BAR", "Beverage", "Steak Goreng"],
    ["BAR", "Grill Fryer", "Teh"],
    ["BAR", "Snacks", "Drink"],
    ["GRILL", "Grill", "Crispy"],
    ["GRILL", "Fryer", "Sate"],
    ["BAR", "Goreng Steak Water", ""],
    ["BAR", "", "Crispy BBQ Kopi"],
    ["GRILL", "", "Goreng Bakar"],
  ] as const)("prioritizes %s across category %s and name %s", (station, category, name) => {
    expect(resolveItemStation(category, name)).toBe(station);
    expect(resolveItemStation(name, category)).toBe(station);
  });
});

describe("filterTicketsByStation", () => {
  const tickets = [
    { id: 1, notes: "mixed", items: [{ name: "Teh" }, { name: "Steak" }, { name: "Sup" }] },
    { id: 2, notes: "empty", items: [] },
    { id: 3, notes: "fried", items: [{ category: "Snacks", name: "Kentang" }] },
    { id: 4, notes: "bar", items: [{ category: "Drinks", name: "Watermelon" }, { name: "Kopi" }] },
    { id: 5, notes: "unknown", items: [{ category: null, name: null }, {}] },
  ];

  it.each([
    ["ALL", [1, 2, 3, 4, 5]],
    ["KITCHEN", [1, 5]],
    ["BAR", [1, 4]],
    ["GRILL", [1]],
    ["FRYER", [3]],
  ] as const)("selects tickets for %s in original order without duplicates", (station, ids) => {
    expect(filterTicketsByStation(tickets, station).map((ticket) => ticket.id)).toEqual(ids);
  });

  it("preserves full ticket objects, all items, and generic metadata", () => {
    const result = filterTicketsByStation(tickets, "BAR");
    expectTypeOf(result).toEqualTypeOf<typeof tickets>();
    expect(result[0]).toBe(tickets[0]);
    expect(result[0].items).toBe(tickets[0].items);
    expect(result[0].items).toHaveLength(3);
    expect(result[0].notes).toBe("mixed");
  });

  it("accepts readonly input without mutating tickets or items", () => {
    const item = Object.freeze({ name: "Teh", quantity: 2 });
    const ticket = Object.freeze({ id: "ticket", items: Object.freeze([item]) });
    const input = Object.freeze([ticket]);
    for (const station of KITCHEN_STATIONS) {
      const result = filterTicketsByStation(input, station);
      expect(result).toEqual(station === "ALL" || station === "BAR" ? [ticket] : []);
    }
    expect(input[0]).toBe(ticket);
    expect(ticket.items[0]).toBe(item);
  });

  it.each(KITCHEN_STATIONS)("handles no tickets for %s", (station) => {
    expect(filterTicketsByStation([], station)).toEqual([]);
  });

  it("applies precedence per item rather than per ticket", () => {
    const input = [{ items: [{ category: "Snacks", name: "BBQ Water" }, { name: "Sate" }] }];
    expect(filterTicketsByStation(input, "BAR")).toEqual(input);
    expect(filterTicketsByStation(input, "GRILL")).toEqual(input);
    expect(filterTicketsByStation(input, "FRYER")).toEqual([]);
  });
});
