import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { auth, getMobileData, room, assignment, cleaningSession, statusLog } = vi.hoisted(() => ({
  auth: vi.fn(), getMobileData: vi.fn(), room: vi.fn(), assignment: vi.fn(), cleaningSession: vi.fn(), statusLog: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`redirect:${path}`); },
  notFound: () => { throw new Error("notFound"); },
}));
vi.mock("@/lib/housekeeper-mobile-data", () => ({ getHousekeeperMobileData: getMobileData }));
vi.mock("./mobile/mobile-view", () => ({ MobileView: () => null }));

vi.mock("@/lib/prisma", () => ({ prisma: {
  room: { findUnique: room },
  housekeepingAssignment: { findFirst: assignment },
  cleaningSession: { findFirst: cleaningSession },
  housekeepingLog: { findFirst: statusLog, fields: { oldStatus: "oldStatus" } },
} }));
vi.mock("./rooms/[roomId]/action-panel", () => ({
  ActionPanel: () => React.createElement("div", { "data-testid": "inspection" }),
}));
vi.mock("./rooms/[roomId]/housekeeper-work-panel", () => ({
  HousekeeperWorkPanel: ({ canStart, canFinish }: { canStart: boolean; canFinish: boolean }) =>
    React.createElement("div", { "data-testid": "work", "data-start": canStart, "data-finish": canFinish }),
}));
vi.mock("./rooms/[roomId]/room-header", () => ({ RoomHeader: () => null }));
vi.mock("./rooms/[roomId]/room-history", () => ({ RoomHistory: () => null }));
vi.mock("./rooms/[roomId]/status-info", () => ({ StatusInfo: () => null }));

import HKRoomDetailPage from "./rooms/[roomId]/page";
import HKLandingPage from "./page";
import HousekeepingMobilePage from "./mobile/page";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("React", React);
  getMobileData.mockResolvedValue({});
  room.mockResolvedValue({ id: 10, number: "101", status: "VCU", roomType: { name: "Deluxe" }, reservations: [], housekeepingLogs: [] });
  assignment.mockResolvedValue(null);
  cleaningSession.mockResolvedValue(null);
  statusLog.mockResolvedValue(null);
});
afterEach(() => vi.unstubAllGlobals());

describe("HK page authorization", () => {
  it.each(["HK", "ADMIN", "GM"])("shows inspection but no cleaning work for unassigned %s", async (role) => {
    auth.mockResolvedValue({ user: { id: "7", role } });
    const html = renderToStaticMarkup(await HKRoomDetailPage({ params: Promise.resolve({ roomId: "10" }) }));
    expect(html).toContain('data-testid="inspection"');
    expect(html).not.toContain('data-testid="work"');
  });

  it.each(["FO", "FB", "ACC"])("does not expose inspection controls to %s", async (role) => {
    auth.mockResolvedValue({ user: { id: "7", role } });
    const html = renderToStaticMarkup(await HKRoomDetailPage({ params: Promise.resolve({ roomId: "10" }) }));
    expect(html).not.toContain('data-testid="inspection"');
    expect(html).not.toContain('data-testid="work"');
  });

  it.each(["ADMIN", "GM"])("keeps assignment and active-session ownership controls for %s", async (role) => {
    auth.mockResolvedValue({ user: { id: "7", role } });
    room.mockResolvedValue({ id: 10, number: "101", status: "VD", roomType: { name: "Deluxe" }, reservations: [], housekeepingLogs: [] });
    assignment.mockResolvedValue({ housekeeperId: 7, housekeeper: { id: 7, fullName: "Operator" } });
    const render = async () => renderToStaticMarkup(await HKRoomDetailPage({ params: Promise.resolve({ roomId: "10" }) }));
    expect(await render()).toContain('data-start="true" data-finish="false"');
    cleaningSession.mockResolvedValue({ housekeeperId: 8, housekeeper: { fullName: "Petugas lain" }, startedAt: new Date(), finishedAt: null });
    expect(await render()).toContain('data-start="false" data-finish="false"');
    cleaningSession.mockResolvedValue({ housekeeperId: 7, housekeeper: { fullName: "Operator" }, startedAt: new Date(), finishedAt: null });
    expect(await render()).toContain('data-start="false" data-finish="true"');
  });

  it.each(["HK", "ADMIN", "GM"])("allows %s through landing and mobile", async (role) => {
    auth.mockResolvedValue({ user: { id: "7", role, fullName: "Operator" } });
    await expect(HKLandingPage()).rejects.toThrow("redirect:/app/hk/rooms");
    const page = await HousekeepingMobilePage();
    expect(page.props).toMatchObject({ userId: 7, userRole: role });
    expect(getMobileData).toHaveBeenCalledWith(7, expect.any(Date));
  });

  it.each(["FO", "FB", "ACC"])("denies %s before loading mobile data", async (role) => {
    auth.mockResolvedValue({ user: { id: "7", role } });
    await expect(HKLandingPage()).rejects.toThrow("redirect:/app/forbidden");
    await expect(HousekeepingMobilePage()).rejects.toThrow("redirect:/app/forbidden");
    expect(getMobileData).not.toHaveBeenCalled();
  });

  it("preserves unauthenticated redirects", async () => {
    auth.mockResolvedValue(null);
    await expect(HKLandingPage()).rejects.toThrow("redirect:/app/forbidden");
    await expect(HousekeepingMobilePage()).rejects.toThrow("redirect:/login");
    expect(getMobileData).not.toHaveBeenCalled();
  });
});
