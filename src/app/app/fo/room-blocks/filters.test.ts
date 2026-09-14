import { describe, expect, it } from "vitest";
import { blockFilterQuery, blockFilterWhere, parseBlockFilters } from "./filters";

describe("room block management filters", () => {
  it("defaults to all blocks without a date restriction", () => {
    const result = parseBlockFilters({});
    expect(result).toEqual({ ok: true, filters: { q: "", startDate: "", endDate: "", reason: "ALL", status: "ALL" } });
    if (result.ok) expect(blockFilterWhere(result.filters)).toEqual({});
  });

  it.each([
    { startDate: "2026-02-30" }, { endDate: "invalid" },
    { startDate: "2026-06-10", endDate: "2026-06-10" },
    { startDate: "2026-06-11", endDate: "2026-06-10" },
    { status: "UNKNOWN" }, { reason: "toString" },
    { status: ["ACTIVE", "RELEASED"] }, { startDate: ["2026-06-01"] },
    { q: "a".repeat(101) },
  ])("rejects unsafe filters %j", (params) => {
    expect(parseBlockFilters(params).ok).toBe(false);
  });

  it("uses half-open overlap, canonical labels, trimmed room search and round-trip URLs", () => {
    const result = parseBlockFilters({ q: " 101 ", startDate: "2026-06-01", endDate: "2026-06-03", status: "ACTIVE", reason: "INSPECTION" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(blockFilterWhere(result.filters)).toEqual({
      room: { number: { contains: "101", mode: "insensitive" } }, status: "ACTIVE", reason: "INSPECTION",
      endDate: { gt: new Date("2026-06-01T00:00:00Z") },
      startDate: { lt: new Date("2026-06-03T00:00:00Z") },
    });
    expect(parseBlockFilters(Object.fromEntries(new URLSearchParams(blockFilterQuery(result.filters))))).toEqual(result);
  });

  it.each(["startDate", "endDate"])("supports a single %s boundary", (key) => {
    const result = parseBlockFilters({ [key]: "2028-02-29" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(Object.keys(blockFilterWhere(result.filters))).toHaveLength(1);
  });
});
