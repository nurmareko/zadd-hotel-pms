import { describe, expect, it } from "vitest";

import { inclusiveArrRange } from "@/lib/arr";

describe("inclusiveArrRange", () => {
  it("converts inclusive report dates to a half-open date-only range", () => {
    const range = inclusiveArrRange("2026-08-01", "2026-08-02");

    expect(range.fromInclusive.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(range.toExclusive.toISOString()).toBe("2026-08-03T00:00:00.000Z");
  });

  it("rejects an end date before the start date", () => {
    expect(() => inclusiveArrRange("2026-08-02", "2026-08-01")).toThrow(
      RangeError,
    );
  });
});
