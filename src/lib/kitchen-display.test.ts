import { describe, expect, it } from "vitest";

import { formatKitchenElapsedTime, isKitchenOrderLate } from "./kitchen-display";

describe("kitchen display time", () => {
  it("marks an order late exactly at 60 minutes", () => {
    const openedAt = new Date("2026-09-22T08:00:00.000Z");
    const atLimit = new Date("2026-09-22T09:00:00.000Z");

    expect(isKitchenOrderLate(openedAt, atLimit)).toBe(true);
  });

  it("formats elapsed time as hours, minutes, and seconds", () => {
    const openedAt = new Date("2026-09-22T08:00:00.000Z");
    const now = new Date("2026-09-22T09:02:03.000Z");

    expect(formatKitchenElapsedTime(openedAt, now)).toBe("01:02:03");
  });
});
