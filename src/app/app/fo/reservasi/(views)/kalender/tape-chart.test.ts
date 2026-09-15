import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TapeChartData, TapeChartRoomBlockData } from "@/lib/tape-chart-data";
import { TapeChart } from "./tape-chart";

const block: TapeChartRoomBlockData = {
  id: 1, roomId: 108, startDate: "2026-09-15", endDate: "2026-09-17",
  reason: "MAINTENANCE", status: "ACTIVE", note: "Perbaikan pipa AC.",
};

function renderChart(roomBlocks: TapeChartRoomBlockData[], isBlockedToday = false) {
  const data: TapeChartData = {
    startDate: "2026-09-14", endDate: "2026-09-28", dayCount: 14,
    roomTypes: [{
      id: 1, code: "STD", name: "Standar", unallocatedReservations: [],
      rooms: [{ id: 108, number: "108", floor: 1, status: "OOO", isBlockedToday, roomBlocks, reservations: [] }],
    }],
  };
  return renderToStaticMarkup(createElement(TapeChart, {
    data, todayIso: "2026-10-01",
    days: Array.from({ length: 14 }, (_, i) => ({
      iso: `2026-09-${14 + i}`, dayNumber: String(14 + i), monthLabel: "Sep", isWeekend: false,
    })),
  }));
}

const bookingLabel = (day: number) => `aria-label="Buat reservasi kamar 108 untuk 2026-09-${day}"`;

describe("tape chart dated block cells", () => {
  it("renders one continuous red block bar while keeping blocked dates unbookable", () => {
    const html = renderChart([block]);
    expect(html).toContain(bookingLabel(14));
    expect(html).not.toContain(bookingLabel(15));
    expect(html).not.toContain(bookingLabel(16));
    expect(html).toContain(bookingLabel(17));
    expect(html).toContain('title="Kamar 108 2026-09-15: Tidak tersedia — Pemeliharaan — Perbaikan pipa AC."');
    expect(html).toContain("lucide-wrench");
    expect(html).toContain("outOfOrderCell");
    expect(html).toContain("unavailableCell");
    expect(html.match(/class="[^"]*roomBlockBar[^"]*"/g)).toHaveLength(1);
    expect(html).toContain("grid-column:4 / 8");
    expect(html).toContain("background-color:#b91c1c");
    expect(html).toContain('title="Kamar 108: Diblokir — Pemeliharaan, 2026-09-15 hingga sebelum 2026-09-17 — Perbaikan pipa AC."');
    expect(html).toMatch(/class="[^"]*barLayer[^"]*" aria-hidden="false"/);
  });

  it("leaves legacy OOO rooms fully bookable without active blocks", () => {
    const html = renderChart([{ ...block, status: "RELEASED" }]);
    for (let day = 14; day < 28; day++) expect(html).toContain(bookingLabel(day));
    expect(html).not.toContain("lucide-wrench");
    expect(html).not.toContain("roomBlockBar");
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
    expect(html).toContain('title="Kamar 108 2026-09-14: Tidak tersedia — Pemeliharaan"');
    expect(html.match(/class="[^"]*roomBlockBar[^"]*"/g)).toHaveLength(2);
    expect(html).toContain("grid-column:2 / 4");
    expect(html).toContain("grid-column:28 / 30");
  });

  it("shows today's header count independently of visible block cells", () => {
    const html = renderChart([], true);
    expect(html).toContain("1 kamar / 1 OOO hari ini");
    for (let day = 14; day < 28; day++) expect(html).toContain(bookingLabel(day));
  });
});
