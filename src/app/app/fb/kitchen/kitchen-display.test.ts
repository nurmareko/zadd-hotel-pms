import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("./actions", () => ({ advanceKitchenOrder: vi.fn() }));

import { KitchenDisplay } from "./kitchen-display";

const source = readFileSync(new URL("./kitchen-display.tsx", import.meta.url), "utf8");
const startedAt = "2026-09-28T03:00:00.000Z";

function renderTicket(kitchenStartedAt: string | null) {
  return renderToStaticMarkup(createElement(KitchenDisplay, {
    initialNow: "2026-09-28T03:05:00.000Z",
    tickets: [{
      id: 7,
      orderNo: "FB-007",
      destination: "Meja 3",
      serviceLabel: "Makan di tempat",
      waiterName: "Sari",
      guestCount: 2,
      openedAt: startedAt,
      kitchenStartedAt,
      items: [{ id: 1, name: "Nasi goreng", category: "Mains", quantity: 2, notes: null }],
    }],
  }));
}

describe("KitchenDisplay server-owned cooking state", () => {
  it("offers START for a not-started or reset ticket", () => {
    const html = renderTicket(null);
    expect(html).toContain("Mulai memasak");
    expect(html).not.toContain("Tandai selesai");
    expect(html).not.toContain("Sedang dimasak");
  });

  it("offers READY when the server supplies a cooking timestamp", () => {
    const html = renderTicket(startedAt);
    expect(html).toContain("Sedang dimasak");
    expect(html).toContain("Tandai selesai");
    expect(html).not.toContain("Mulai memasak");
  });

  it("renders station filters, local readiness, and display controls", () => {
    const html = renderTicket(null);
    for (const label of ["Semua", "Dapur", "Bar", "Panggangan", "Gorengan", "Tandai Siap", "0 dari 1 siap", "2 tamu", "Suara hening", "Layar penuh", "Hidangan utama"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("hanya di layar ini");
  });

  it("highlights late tickets at the existing one-hour threshold", () => {
    const html = renderToStaticMarkup(createElement(KitchenDisplay, {
      initialNow: "2026-09-28T04:00:00.000Z",
      tickets: [{ id: 8, orderNo: "FB-008", destination: "Meja 4", serviceLabel: "Makan di tempat", waiterName: "Sari", openedAt: startedAt, kitchenStartedAt: null, items: [] }],
    }));
    expect(html).toContain("TERLAMBAT");
    expect(html).toContain("border-red-500");
    expect(html).toContain("motion-safe:animate-pulse");
    expect(renderTicket(null)).not.toContain("TERLAMBAT");
  });

  // Server rendering cannot exercise a mounted router refresh. These source
  // guards prevent restoring the duplicated state that survives such a refresh.
  it("derives cooking state from the prop without an optimistic cooking setter", () => {
    expect(source).toMatch(/const isCooking = ticket\.kitchenStartedAt !== null/);
    expect(source).not.toMatch(/setIsCooking|useState\(ticket\./);
    expect(source).not.toMatch(/isCooking:\s*boolean/);
  });

  it("submits the exact rendered timestamp with the prop-derived transition", () => {
    expect(source).toMatch(/advanceKitchenOrder\(\{\s*orderId: ticket\.id,\s*transition: isCooking \? "READY" : "START",\s*expectedKitchenStartedAt: ticket\.kitchenStartedAt,\s*\}\)/);
  });

  it("uses Indonesian order copy", () => {
    expect(renderTicket(null)).toContain('aria-label="Pesanan FB-007"');
    const empty = renderToStaticMarkup(createElement(KitchenDisplay, {
      tickets: [], initialNow: startedAt,
    }));
    expect(empty).toContain("pesanan yang masih terbuka");
    expect(empty).not.toContain("order yang masih terbuka");
  });
});
