import { RoomStatus } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HousekeepingListRow } from "@/lib/housekeeping-list-data";

const { auth, getHousekeepingListData } = vi.hoisted(() => ({
  auth: vi.fn(),
  getHousekeepingListData: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/housekeeping-list-data", () => ({ getHousekeepingListData }));

import { GET } from "./route";

const header = "Kode Tugas,Kamar,Lantai,Tipe Kamar,Prioritas,Status,Petugas,Konteks Tamu,Catatan";
const request = (query = "") => new Request(`http://localhost/app/hk/rooms/export${query ? `?${query}` : ""}`);

function roomRow(): HousekeepingListRow {
  return {
    taskCode: "TSK-102",
    priority: "P1",
    taskNote: "Bersihkan kaca",
    room: { id: 1, number: "102", floor: 1, typeName: "Deluks", typeCode: "DLX", status: "VD" },
    cleaningState: "IN_PROGRESS",
    serviceLabel: "Persiapan kedatangan",
    assignedHousekeeper: { id: 2, name: "Siti", initials: "S" },
    reservationContexts: [{ kind: "arrival", label: "Kedatangan", reservationNo: "RSV-001", guestName: "Budi", nightsLabel: "2 malam", etaLabel: "12:00" }],
    note: { reservationNo: "RSV-001", etaLabel: "12:00", notes: "Bantal tambahan" },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  // The filename must use the hotel day (WIB), not the UTC day or selected day.
  vi.setSystemTime(new Date("2026-09-16T18:00:00Z"));
  auth.mockResolvedValue({ user: { role: "HK" } });
  getHousekeepingListData.mockResolvedValue({ date: new Date("2026-09-17"), rows: [roomRow()] });
});
afterEach(() => vi.useRealTimers());

describe("GET /app/hk/rooms/export", () => {
  it.each([null, {}])("returns 401 without a user (%j), before validation or queries", async (session) => {
    auth.mockResolvedValue(session);
    expect((await GET(request("date=invalid"))).status).toBe(401);
    expect(getHousekeepingListData).not.toHaveBeenCalled();
  });

  it.each(["FO", "FB", "ACC", "UNKNOWN"])("returns 403 for %s before validation or queries", async (role) => {
    auth.mockResolvedValue({ user: { role } });
    expect((await GET(request("status=invalid"))).status).toBe(403);
    expect(getHousekeepingListData).not.toHaveBeenCalled();
  });

  it.each(["HK", "ADMIN"])("exports nine columns with attachment headers and UTF-8 BOM for %s", async (role) => {
    auth.mockResolvedValue({ user: { role } });
    const response = await GET(request("date=2024-02-29"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="papan-kamar-2026-09-17.csv"');
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes)).toBe(`${header}\r\nTSK-102,102,1,Deluks,P1 - Mendesak,VD,Siti,Kedatangan: Budi (RSV-001) · 2 malam · ETA 12:00,Bersihkan kaca | Bantal tambahan`);
  });

  it("delegates the default date and uses priority ascending without filters", async () => {
    await GET(request());
    expect(getHousekeepingListData).toHaveBeenCalledExactlyOnceWith({ q: "", sortBy: "priority", sortOrder: "asc" });
  });

  it("passes validated filters, a UTC date-only boundary and trimmed search", async () => {
    await GET(request("date=2024-02-29&q=%20Budi%20&status=VD&priority=P2&sortBy=assignee&sortOrder=desc"));
    expect(getHousekeepingListData).toHaveBeenCalledExactlyOnceWith({ date: new Date("2024-02-29T00:00:00.000Z"), q: "Budi", status: "VD", priority: "P2", sortBy: "assignee", sortOrder: "desc" });
  });

  it.each([
    ...Object.values(RoomStatus).map((value) => `status=${value}`),
    ...["P1", "P2", "P3", "P4", "P5"].map((value) => `priority=${value}`),
    ...["priority", "room", "floor", "status", "assignee"].map((value) => `sortBy=${value}`),
    "sortOrder=asc", "sortOrder=desc", "q=%20%20",
  ])("accepts allowlisted filter %s", async (query) => {
    expect((await GET(request(query))).status).toBe(200);
  });

  it.each([
    "date=2026-02-29", "date=2026-02-30", "date=2026-13-01", "date=2026-9-01",
    "date=2026-09-17T00:00:00Z", "date=invalid", "date=",
    "status=INVALID", "status=vd", "status=IN_PROGRESS", "status=",
    "priority=P0", "priority=P6", "priority=toString", "priority=",
    "sortBy=guest", "sortBy=toString", "sortBy=", "sortOrder=ASC", "sortOrder=invalid", "sortOrder=",
    ...["date=2026-09-17", "q=Budi", "status=VD", "priority=P1", "sortBy=room", "sortOrder=asc"].map((filter) => `${filter}&${filter}`),
    "status=VD&status=OC",
  ])("rejects invalid or repeated filters before querying: %s", async (query) => {
    expect((await GET(request(query))).status).toBe(400);
    expect(getHousekeepingListData).not.toHaveBeenCalled();
  });

  it("exports a header-only CSV for an empty result", async () => {
    getHousekeepingListData.mockResolvedValue({ rows: [] });
    expect(await (await GET(request())).text()).toBe(header);
  });

  it("handles missing assignee, guest context and notes", async () => {
    getHousekeepingListData.mockResolvedValue({ rows: [{ ...roomRow(), assignedHousekeeper: null, reservationContexts: [], taskNote: null, note: null }] });
    expect(await (await GET(request())).text()).toBe(`${header}\r\nTSK-102,102,1,Deluks,P1 - Mendesak,VD,,,`);
  });

  it.each(["=SUM(1,2)", "+SUM(1,2)", "-SUM(1,2)", "@SUM(1,2)", "\tSUM(1,2)", "\rSUM(1,2)"])("uses real CSV formula protection for %j", async (value) => {
    getHousekeepingListData.mockResolvedValue({ rows: [{ ...roomRow(), assignedHousekeeper: { id: 2, name: value, initials: "S" }, taskNote: value, note: null }] });
    const csv = await (await GET(request())).text();
    expect(csv).toContain(`,"'${value}",`);
    expect(csv).toContain(`,"'${value}"`);
  });

  it("quotes commas, quotes and newlines while retaining both notes and multiple guest contexts", async () => {
    const row = roomRow();
    row.taskNote = 'Kaca, "bersih"\nPeriksa';
    row.reservationContexts.push({ kind: "departure", label: "Keberangkatan", reservationNo: "RSV-002", guestName: "Ani", nightsLabel: "1 malam", etaLabel: null });
    getHousekeepingListData.mockResolvedValue({ rows: [row] });
    const csv = await (await GET(request())).text();
    expect(csv).toContain('"Kaca, ""bersih""\nPeriksa | Bantal tambahan"');
    expect(csv).toContain(" | Keberangkatan: Ani (RSV-002) · 1 malam");
  });
});
