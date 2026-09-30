import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppRole } from "@/auth";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { nightAudit: { findUnique: mocks.findUnique } },
}));

import { getRoleNavBadges } from "./nav-badges";

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-28T18:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getRoleNavBadges night_audit:run authorization", () => {
  describe.each(["ACC", "ADMIN", "GM"] as const)("%s", (role) => {
    it("returns the pending badge when today's audit has not run", async () => {
      mocks.findUnique.mockResolvedValue(null);

      await expect(getRoleNavBadges(role)).resolves.toEqual({
        "/app/acc/night-audit": {
          value: "!",
          label: "Night Audit hari ini belum dijalankan",
        },
      });
      expect(mocks.findUnique).toHaveBeenCalledTimes(1);
      expect(mocks.findUnique).toHaveBeenCalledWith({
        where: { businessDate: new Date("2026-09-29T00:00:00.000Z") },
        select: { id: true },
      });
    });

    it("returns no badge when today's audit is completed", async () => {
      mocks.findUnique.mockResolvedValue({ id: 1 });

      await expect(getRoleNavBadges(role)).resolves.toEqual({});
      expect(mocks.findUnique).toHaveBeenCalledTimes(1);
      expect(mocks.findUnique).toHaveBeenCalledWith({
        where: { businessDate: new Date("2026-09-29T00:00:00.000Z") },
        select: { id: true },
      });
    });
  });

  it.each(["FO", "HK", "FB", "UNKNOWN", undefined, null])(
    "returns no badge for %s without querying audit data",
    async (role) => {
      await expect(getRoleNavBadges(role as AppRole)).resolves.toEqual({});
      expect(mocks.findUnique).not.toHaveBeenCalled();
    },
  );
});
