import { describe, expect, it } from "vitest";

import {
  addDateOnlyDays,
  hotelTimestampBoundaryForDate,
  hotelTodayDateOnly,
  hotelTodayISO,
  hotelTodayTimestampRange,
  parseISODateOnly,
} from "@/lib/date-only";
import { dateOnlyRange } from "@/lib/stay-date-range";

describe("date-only helpers", () => {
  it.each([
    ["2026-01-31", 1, "2026-02-01T00:00:00.000Z"],
    ["2026-12-31", 1, "2027-01-01T00:00:00.000Z"],
  ])("adds days across calendar edges", (start, days, expected) => {
    expect(addDateOnlyDays(parseISODateOnly(start), days).toISOString()).toBe(
      expected,
    );
  });

  it("resolves hotel today from WIB even while the UTC date is still yesterday", () => {
    const now = new Date("2026-05-31T17:40:00.000Z");

    expect(hotelTodayISO(now)).toBe("2026-06-01");
    expect(hotelTodayDateOnly(now).toISOString()).toBe(
      "2026-06-01T00:00:00.000Z",
    );
  });

  it("returns the UTC timestamp boundaries for one WIB operating day", () => {
    const range = hotelTodayTimestampRange(
      new Date("2026-05-31T17:40:00.000Z"),
    );

    expect(range.start.toISOString()).toBe("2026-05-31T17:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-06-01T17:00:00.000Z");
  });

  it("converts a selected WIB calendar date to its UTC timestamp boundary", () => {
    expect(hotelTimestampBoundaryForDate("2026-06-01").toISOString()).toBe(
      "2026-05-31T17:00:00.000Z",
    );
  });
});

describe("dateOnlyRange", () => {
  it("uses a half-open stay range with exactly two service dates", () => {
    expect(dateOnlyRange("2026-08-01", "2026-08-03")).toEqual([
      "2026-08-01",
      "2026-08-02",
    ]);
  });

  it("returns an empty range for same-day arrival and departure", () => {
    expect(dateOnlyRange("2026-08-01", "2026-08-01")).toEqual([]);
  });
});
