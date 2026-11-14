import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  roomType: { findMany: vi.fn() },
  reservation: { findMany: vi.fn() },
  roomBlock: { findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { getTapeChartData } from "@/lib/tape-chart-data";
import { TapeChartLegend } from "./tape-chart-legend";
import type { TapeChartData, TapeChartRoomBlockData, TapeChartRoomData } from "@/lib/tape-chart-data";
import { TapeChart } from "./tape-chart";

const block: TapeChartRoomBlockData = {
  id: 1, roomId: 108, startDate: "2026-09-15", endDate: "2026-09-17",
  reason: "MAINTENANCE", status: "ACTIVE", note: "Perbaikan pipa AC.",
};

function renderChart(
  roomBlocks: TapeChartRoomBlockData[],
  isBlockedToday = false,
  todayIso = "2026-10-01",
  status: TapeChartRoomData["status"] = "OOO",
  additionalRooms: TapeChartRoomData[] = [],
  unallocatedReservations: TapeChartRoomData["reservations"] = [],
) {
  const data: TapeChartData = {
    startDate: "2026-09-14", endDate: "2026-09-28", dayCount: 14,
    roomTypes: [{
      id: 1, code: "STD", name: "Standar", unallocatedReservations,
      rooms: [{ id: 108, number: "108", floor: 1, status, isBlockedToday, roomBlocks, reservations: [] }, ...additionalRooms],
    }],
  };
  return renderToStaticMarkup(createElement(TapeChart, {
    data, todayIso,
    days: Array.from({ length: 14 }, (_, i) => ({
      iso: `2026-09-${14 + i}`, dayNumber: String(14 + i), monthLabel: "Sep", isWeekend: false,
    })),
  }));
}

describe("tape chart deposit presentation", () => {
  it.each(["PENDING", "COLLECTED"] as const)("selects and maps %s for allocated and unallocated reservations", async (depositStatus) => {
    db.roomType.findMany.mockResolvedValue([{
      id: 1, code: "STD", name: "Standard",
      rooms: [{ id: 108, number: "108", floor: 1, status: "VC" }],
    }]);
    db.roomBlock.findMany.mockResolvedValue([]);
    const reservation = {
      id: 10, groupBookingId: null, roomTypeId: 1, roomId: 108,
      arrivalDate: new Date("2026-09-15T00:00:00Z"),
      departureDate: new Date("2026-09-17T00:00:00Z"),
      status: "CONFIRMED", depositStatus, guest: { fullName: "Test Guest" },
    };
    db.reservation.findMany.mockResolvedValue([reservation, { ...reservation, id: 11, roomId: null }]);
    const data = await getTapeChartData(new Date("2026-09-14T00:00:00Z"), 14);
    expect(db.reservation.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      select: expect.objectContaining({ depositStatus: true }),
    }));
    expect(data.roomTypes[0].rooms[0].reservations[0]).toMatchObject({ id: 10, depositStatus });
    expect(data.roomTypes[0].unallocatedReservations[0]).toMatchObject({ id: 11, depositStatus });
  });

  it.each([
    ["COLLECTED", "Guaranteed", "#f97316"],
    ["PENDING", "Tentative", "#fef3c7"],
  ] as const)("renders confirmed %s with matching labels and styling", (depositStatus, label, color) => {
    const html = renderChart([], false, "2026-10-01", "VC", [{
      id: 109, number: "109", floor: 1, status: "VC", isBlockedToday: false,
      roomBlocks: [], reservations: [{
        id: 10, groupBookingId: null, guestName: "Test Guest",
        checkInDate: "2026-09-15", checkOutDate: "2026-09-17",
        status: "CONFIRMED", depositStatus,
      }],
    }]);
    const link = html.match(/<a[^>]*href="\/app\/fo\/reservasi\/10"[^>]*>/)?.[0];
    expect(link).toContain(`aria-label="Test Guest, ${label}, 2026-09-15 to 2026-09-17"`);
    expect(link).toContain(`title="Test Guest, ${label}, 2026-09-15 to 2026-09-17"`);
    expect(link).toContain(`background-color:${color}`);
    if (depositStatus === "PENDING") expect(link).toContain("border:2px dashed currentColor");
    else expect(link).not.toContain("dashed");
  });

  it.each(["CHECKED_IN", "CHECKED_OUT"] as const)("keeps %s independent of deposit status", (status) => {
    for (const depositStatus of ["PENDING", "COLLECTED"] as const) {
      const html = renderChart([], false, "2026-10-01", "VC", [{
        id: 109, number: "109", floor: 1, status: "VC", isBlockedToday: false,
        roomBlocks: [], reservations: [{
          id: 10, groupBookingId: null, guestName: "Test Guest",
          checkInDate: "2026-09-15", checkOutDate: "2026-09-17", status, depositStatus,
        }],
      }]);
      expect(html).not.toMatch(/Guaranteed|Tentative|dashed/);
      expect(html).toContain(status === "CHECKED_IN" ? "Checked In" : "Checked Out");
    }
  });

  it.each(["PENDING", "COLLECTED"] as const)("preserves blue unallocated bars with %s confirmation labels", (depositStatus) => {
    const html = renderChart([], false, "2026-10-01", "VC", [], [{
      id: 10, groupBookingId: null, guestName: "Test Guest",
      checkInDate: "2026-09-15", checkOutDate: "2026-09-17",
      status: "CONFIRMED", depositStatus,
    }]);
    const link = html.match(/<a[^>]*href="\/app\/fo\/reservasi\/10"[^>]*>/)?.[0];
    const label = `Test Guest, Not assigned, ${depositStatus === "PENDING" ? "Tentative" : "Guaranteed"}, 2026-09-15 to 2026-09-17`;
    expect(link).toContain(`aria-label="${label}"`);
    expect(link).toContain(`title="${label}"`);
    expect(link).toContain("background-color:#2563eb");
    if (depositStatus === "PENDING") expect(link).toContain("border:2px dashed currentColor");
    else expect(link).not.toContain("dashed");
  });

  it("shows matching guaranteed and tentative legend swatches", () => {
    const html = renderToStaticMarkup(createElement(TapeChartLegend));
    expect(html).toContain("Guaranteed");
    expect(html).toContain("Tentative");
    expect(html).toContain("background-color:#f97316");
    expect(html).toContain("background-color:#fef3c7");
    expect(html).toContain('aria-label="Physical Status: Out of Order"');
    expect(html).toContain("outOfOrderCell");
    expect(html).toContain("text-red-700");
    expect(html).toContain("OOO");
    expect(html).toContain("border:2px dashed currentColor");
  });
});

const bookingLabel = (day: number) => `aria-label="Create room reservation 108 for 2026-09-${day}"`;

describe("tape chart dated block cells", () => {
  it("renders one continuous red block bar while keeping blocked dates unbookable", () => {
    const html = renderChart([block]);
    expect(html).toContain(bookingLabel(14));
    expect(html).not.toContain(bookingLabel(15));
    expect(html).not.toContain(bookingLabel(16));
    expect(html).toContain(bookingLabel(17));
    expect(html).toContain('title="Room 108 2026-09-15: Unavailable — Maintenance — Perbaikan pipa AC."');
    expect(html).toContain("lucide-wrench");
    expect(html).toContain("outOfOrderCell");
    expect(html).toContain("unavailableCell");
    expect(html.match(/class="[^"]*roomBlockBar[^"]*"/g)).toHaveLength(1);
    expect(html).toContain("grid-column:4 / 8");
    expect(html).toContain("background-color:#b91c1c");
    expect(html).toContain('title="Room 108: Blocked — Maintenance, 2026-09-15 up to but not including 2026-09-17 — Perbaikan pipa AC."');
    expect(html).toMatch(/class="[^"]*barLayer[^"]*" aria-hidden="false"/);
  });

  it("keeps physical OOO bookable on dates other than today without active blocks", () => {
    const html = renderChart([{ ...block, status: "RELEASED" }]);
    for (let day = 14; day < 28; day++) expect(html).toContain(bookingLabel(day));
    expect(html).toContain("lucide-wrench");
    expect(html).toContain('aria-label="Physical Status: Out of Order"');
    expect(html).not.toContain(">Physical Status:");
    expect(html).toContain("1 rooms / 1 OOO today");
    expect(html).not.toContain("roomBlockBar");
  });

  it.each([
    ["OOO", false, "Physical Status: Out of Order"],
    ["VC", true, "Out of Order"],
    ["OOO", true, "Physical Status: Out of Order"],
  ] as const)("disables today's cell for status %s and blockedToday %s", (status, blockedToday, label) => {
    const html = renderChart([], blockedToday, "2026-09-14", status);
    expect(html).toContain("1 rooms / 1 OOO today");
    expect(html).toContain(`aria-label="${label}"`);
    expect(html).toContain("lucide-wrench");
    expect(html).toContain("--row-height:26px");
    expect(html).toContain("--group-header-height:26px");
    expect(html).toContain("--date-header-height:32px");
    expect(html).toContain("--room-label-width:200px");
    expect(html).not.toContain(bookingLabel(14));
    const cell = html.match(/<div[^>]*aria-label="Room 108 2026-09-14: Unavailable[^>]*>/)?.[0];
    expect(cell).toBeDefined();
    expect(cell).toContain("outOfOrderCell");
    expect(cell).toContain("unavailableCell");
    expect(cell).toContain('role="img"');
    expect(cell).not.toContain("bookableCell");
    expect(cell).not.toContain("href=");
    for (let day = 15; day < 28; day++) expect(html).toContain(bookingLabel(day));
    expect(html).not.toContain("roomBlockBar");
  });

  it("counts the union of physical OOO and blocked rooms without double counting", () => {
    const rooms: TapeChartRoomData[] = [
      { id: 109, number: "109", floor: 1, status: "VC", isBlockedToday: true, roomBlocks: [], reservations: [] },
      { id: 110, number: "110", floor: 1, status: "OOO", isBlockedToday: true, roomBlocks: [], reservations: [] },
      { id: 111, number: "111", floor: 1, status: "VC", isBlockedToday: false, roomBlocks: [], reservations: [] },
    ];
    const html = renderChart([], false, "2026-09-14", "OOO", rooms);
    expect(html).toContain("4 rooms / 3 OOO today");
    expect(html).toContain('aria-label="Create room reservation 111 for 2026-09-14"');
  });

  it("preserves today's dated block reason and bar for a physical OOO room", () => {
    const html = renderChart([block], true, "2026-09-15");
    expect(html).toContain('aria-label="Physical Status: Out of Order"');
    expect(html).not.toContain(">Physical Status:");
    expect(html).toContain('aria-label="Room 108 2026-09-15: Unavailable — Maintenance — Perbaikan pipa AC."');
    expect(html.match(/class="[^"]*roomBlockBar[^"]*"/g)).toHaveLength(1);
    expect(html).not.toContain(bookingLabel(15));
    expect(html).toContain(bookingLabel(17));
  });

  it("retains reservation links over unavailable physical OOO cells", () => {
    const html = renderChart([], false, "2026-09-14", "VC", [{
      id: 109, number: "109", floor: 1, status: "OOO", isBlockedToday: false,
      roomBlocks: [], reservations: [{
        id: 10, groupBookingId: null, guestName: "Tamu Uji",
        checkInDate: "2026-09-14", checkOutDate: "2026-09-16", status: "CONFIRMED", depositStatus: "COLLECTED",
      }],
    }]);
    expect(html).toContain('href="/app/fo/reservasi/10"');
    expect(html).toContain("Tamu Uji");
    expect(html).not.toContain('aria-label="Create room reservation 109 for 2026-09-14"');
    expect(html).toContain('aria-label="Create room reservation 109 for 2026-09-17"');
  });

  it("clips blocks at either window boundary and supports missing notes", () => {
    const html = renderChart([
      { ...block, startDate: "2026-09-10", endDate: "2026-09-15", note: null },
      { ...block, id: 2, startDate: "2026-09-27", endDate: "2026-10-02" },
    ]);
    expect(html).not.toContain(bookingLabel(14));
    expect(html).toContain(bookingLabel(15));
    expect(html).toContain(bookingLabel(26));
    expect(html).not.toContain(bookingLabel(27));
    expect(html).toContain('title="Room 108 2026-09-14: Unavailable — Maintenance"');
    expect(html.match(/class="[^"]*roomBlockBar[^"]*"/g)).toHaveLength(2);
    expect(html).toContain("grid-column:2 / 4");
    expect(html).toContain("grid-column:28 / 30");
  });

  it("shows today's header count independently of visible block cells", () => {
    const html = renderChart([], true);
    expect(html).toContain("1 rooms / 1 OOO today");
    for (let day = 14; day < 28; day++) expect(html).toContain(bookingLabel(day));
  });
});
