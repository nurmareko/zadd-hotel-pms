import { describe, expect, it } from "vitest";

import { buildExportQuery, buildReservationListWhere, parseReservationListParams } from "./query";

const now = new Date("2026-09-23T06:00:00.000Z");
const today = new Date("2026-09-23T00:00:00.000Z");

describe("buildReservationListWhere", () => {
  it("matches today's arrivals without constraining departure dates", () => {
    expect(buildReservationListWhere({ preset: "today_arrivals" }, now)).toEqual({
      arrivalDate: today,
      status: { in: ["CONFIRMED", "CHECKED_IN"] },
    });
  });

  it("matches today's departures without constraining arrival dates", () => {
    expect(buildReservationListWhere({ preset: "today_departures" }, now)).toEqual({
      departureDate: today,
      status: { in: ["CHECKED_IN", "CHECKED_OUT"] },
    });
  });

  it.each(["today_arrivals", "today_departures"] as const)("respects explicit status for %s", (preset) => {
    expect(buildReservationListWhere({ preset, status: "NO_SHOW" }, now).status).toBe("NO_SHOW");
    expect(buildReservationListWhere({ preset, status: "ALL" }, now)).not.toHaveProperty("status");
  });

  it("preserves custom ranges and active statuses without a preset", () => {
    expect(buildReservationListWhere({ checkIn: "2026-09-20", checkOut: "2026-09-25" }, now)).toEqual({
      arrivalDate: { gte: new Date("2026-09-20T00:00:00.000Z") },
      departureDate: { lte: new Date("2026-09-25T00:00:00.000Z") },
      status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
    });
  });

  it("ignores custom ranges when a preset is active", () => {
    expect(buildReservationListWhere({ preset: "today_arrivals", checkIn: "2026-09-01", checkOut: "2026-09-02" }, now)).toEqual(
      buildReservationListWhere({ preset: "today_arrivals" }, now),
    );
  });

  it("uses the Jakarta day when UTC is still on the previous day", () => {
    expect(buildReservationListWhere({ preset: "today_arrivals" }, new Date("2026-09-22T17:00:00.000Z")).arrivalDate).toEqual(today);
  });

  it("retains case-insensitive guest and reservation search", () => {
    expect(buildReservationListWhere({ q: "Sari", preset: "today_departures" }, now).OR).toEqual([
      { reservationNo: { contains: "Sari", mode: "insensitive" } },
      { guest: { fullName: { contains: "Sari", mode: "insensitive" } } },
    ]);
  });

  it("ignores invalid dates and keeps valid one-sided ranges", () => {
    expect(buildReservationListWhere({ checkIn: "2026-02-30", checkOut: "2026-09-25", status: "ALL" })).toEqual({
      departureDate: { lte: new Date("2026-09-25T00:00:00.000Z") },
    });
    expect(buildReservationListWhere({ checkIn: "2026-09-20", status: "ALL" })).toEqual({
      arrivalDate: { gte: new Date("2026-09-20T00:00:00.000Z") },
    });
  });
});

describe("reservation list query parameters", () => {
  it("serializes all filters including the preset", () => {
    expect(buildExportQuery({ q: "Sari & Co", status: "CHECKED_IN", checkIn: "2026-09-20", checkOut: "2026-09-25", preset: "today_arrivals" })).toBe(
      "q=Sari+%26+Co&status=CHECKED_IN&checkIn=2026-09-20&checkOut=2026-09-25&preset=today_arrivals",
    );
    expect(buildExportQuery({})).toBe("");
  });

  it("normalizes status and search and takes the first repeated parameter", () => {
    expect(parseReservationListParams({ q: [" Sari ", "other"], status: "checked_in", preset: ["today_departures", "today_arrivals"], checkIn: " 2026-09-20 " })).toEqual({
      q: "Sari", status: "CHECKED_IN", preset: "today_departures", checkIn: "2026-09-20", checkOut: undefined,
    });
  });

  it("falls back safely for unknown presets and statuses", () => {
    const filters = parseReservationListParams({ status: "invalid", preset: "invalid", checkIn: "2026-09-20" });
    expect(filters.status).toBe("");
    expect(filters.preset).toBeUndefined();
    expect(buildReservationListWhere(filters).arrivalDate).toEqual({ gte: new Date("2026-09-20T00:00:00.000Z") });
  });

  it.each(["today_arrivals", "today_departures"] as const)("round-trips export filters for %s", (preset) => {
    const filters = { q: "Sari", preset, status: "ALL" as const };
    const parsed = parseReservationListParams(Object.fromEntries(new URLSearchParams(buildExportQuery(filters))));
    expect(buildReservationListWhere(parsed, now)).toEqual(buildReservationListWhere(filters, now));
  });
});
