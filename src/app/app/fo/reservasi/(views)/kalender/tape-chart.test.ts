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
  it("renders wrench cells with Indonesian reason and note only on blocked dates", () => {
    const html = renderChart([block]);
    expect(html).toContain(bookingLabel(14));
    expect(html).not.toContain(bookingLabel(15));
    expect(html).not.toContain(bookingLabel(16));
    expect(html).toContain(bookingLabel(17));
    expect(html).toContain('title="Kamar 108 2026-09-15: Tidak tersedia — Pemeliharaan — Perbaikan pipa AC."');
    expect(html).toContain("lucide-wrench");
    expect(html).toContain("outOfOrderCell");
    expect(html).toContain("unavailableCell");
  });

  it("leaves legacy OOO rooms fully bookable without active blocks", () => {
    const html = renderChart([{ ...block, status: "RELEASED" }]);
    for (let day = 14; day < 28; day++) expect(html).toContain(bookingLabel(day));
    expect(html).not.toContain("lucide-wrench");
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
  });

  it("shows today's header count independently of visible block cells", () => {
    const html = renderChart([], true);
    expect(html).toContain("1 kamar / 1 OOO hari ini");
    for (let day = 14; day < 28; day++) expect(html).toContain(bookingLabel(day));
  });
});
