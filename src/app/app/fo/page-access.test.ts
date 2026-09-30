import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), query: vi.fn(), redirect: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    room: { findMany: mocks.query },
    user: { findMany: mocks.query, findFirst: mocks.query },
    activityLog: { findMany: mocks.query },
  },
}));
vi.mock("@/lib/guests/queries", () => ({ findGuests: mocks.query }));
vi.mock("./room-blocks/queries", () => ({ findRoomBlocks: mocks.query }));
vi.mock("./room-blocks/block-dialogs", () => ({ CreateBlockDialog: vi.fn(), ReleaseBlockDialog: vi.fn() }));
vi.mock("./tamu/guest-filters", () => ({ GuestFilters: vi.fn() }));
vi.mock("./tamu/guest-table", () => ({ GuestTable: vi.fn() }));

import GuestDirectoryPage from "./tamu/page";
import RoomBlocksPage from "./room-blocks/page";
import StaffPerformancePage from "./staff-performance/page";
import StaffHistoryPage from "./staff-performance/[userId]/page";

const dataBoundary = new Error("authorized data access");
beforeEach(() => {
  vi.resetAllMocks();
  // Stop at the data boundary: these tests exercise page guards, not rendering.
  mocks.query.mockImplementation(() => { throw dataBoundary; });
  mocks.redirect.mockImplementation((path: string) => { throw new Error(`redirect:${path}`); });
});

const pages = [
  { name: "guest directory", render: () => GuestDirectoryPage({ searchParams: Promise.resolve({}) }), anonymousRedirect: "/login" },
  { name: "room blocks", render: () => RoomBlocksPage({ searchParams: Promise.resolve({}) }), anonymousRedirect: "/login" },
  { name: "staff performance", render: () => StaffPerformancePage({ searchParams: Promise.resolve({}) }), anonymousRedirect: "/app/forbidden" },
  { name: "staff history", render: () => StaffHistoryPage({ params: Promise.resolve({ userId: "1" }), searchParams: Promise.resolve({}) }), anonymousRedirect: "/app/forbidden" },
];

describe.each(pages)("$name authorization", ({ render, anonymousRedirect }) => {
  it.each(["FO", "ADMIN", "GM"])("allows %s to reach the data boundary", async (role) => {
    mocks.auth.mockResolvedValue({ user: { role } });
    await expect(render()).rejects.toBe(dataBoundary);
    expect(mocks.query).toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it.each(["HK", "FB", "ACC", "UNKNOWN"])("rejects %s before data access", async (role) => {
    mocks.auth.mockResolvedValue({ user: { role } });
    await expect(render()).rejects.toThrow("redirect:/app/forbidden");
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("preserves the unauthenticated redirect before data access", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(render()).rejects.toThrow(`redirect:${anonymousRedirect}`);
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
