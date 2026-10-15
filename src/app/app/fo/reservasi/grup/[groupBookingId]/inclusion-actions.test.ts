import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STAY_CHARGE_ARTICLE_CODES } from "@/lib/stay-charges";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), findMany: vi.fn(), changeMealPlan: vi.fn(), setStayFee: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  reservation: { findMany: mocks.findMany },
  article: { findMany: async () => [] },
} }));
vi.mock("@/lib/reservation-inclusions/actions", () => ({ changeReservationMealPlan: mocks.changeMealPlan, setReservationStayFee: mocks.setStayFee }));

import { applyGroupMealPlan, applyGroupStayFees, previewGroupMealPlan } from "./inclusion-actions";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findMany.mockResolvedValue([]);
});

describe("group Arrangement eligibility", () => {
  const reservation = {
    id: 1, reservationNo: "RSV-1", groupBookingId: "group-1", status: "CHECKED_IN",
    arrangementType: "RO", adults: 2, children: 0, roomType: { capacity: 2 }, room: null,
  };
  const roomPostedNight = {
    id: "room-posted", date: new Date("2099-01-01"), rateAmount: new Prisma.Decimal(500000),
    folioLineItems: [{ id: "room-line" }],
  };

  it.each([false, true])("locks ROOM-CHARGE-only nights; another eligible night: %s", async (hasUnpostedNight) => {
    mocks.auth.mockResolvedValue({ user: { role: "FO" } });
    mocks.findMany.mockResolvedValueOnce([reservation]).mockResolvedValueOnce([{
      ...reservation,
      reservationNights: [roomPostedNight, ...(hasUnpostedNight ? [{
        id: "unposted", date: new Date("2099-01-02"),
        rateAmount: new Prisma.Decimal(100000), folioLineItems: [],
      }] : [])],
    }]);
    const result = await previewGroupMealPlan({ groupBookingId: "group-1", scope: "all", arrangementType: "BB" });
    expect(mocks.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      select: expect.objectContaining({ reservationNights: expect.objectContaining({
        select: expect.objectContaining({
          rateAmount: true,
          folioLineItems: expect.objectContaining({
            where: { article: { code: { in: [...STAY_CHARGE_ARTICLE_CODES] } } },
          }),
        }),
      }) }),
    }));
    expect(result).toMatchObject({ ok: true, rooms: [{
      eligible: hasUnpostedNight,
      nightsAffected: hasUnpostedNight ? 1 : 0,
      expectedAmount: hasUnpostedNight ? "100000" : "0",
    }] });
  });

  it("marks a room ineligible when one unposted night's allocation exceeds its package", async () => {
    mocks.auth.mockResolvedValue({ user: { role: "FO" } });
    mocks.findMany.mockResolvedValueOnce([reservation]).mockResolvedValueOnce([{
      ...reservation, reservationNights: [{
        id: "unposted", date: new Date("2099-01-02"),
        rateAmount: new Prisma.Decimal(99999), folioLineItems: [],
      }],
    }]);
    await expect(previewGroupMealPlan({ groupBookingId: "group-1", scope: "all", arrangementType: "BB" }))
      .resolves.toMatchObject({ ok: true, rooms: [{
        eligible: false, reason: expect.stringMatching(/2099-01-02.*100000.*99999/),
      }] });
  });
});

const selection = { groupBookingId: "group-1", scope: "all" };
const actions = [
  { name: "preview meal plan", run: () => previewGroupMealPlan({ ...selection, arrangementType: "BB" }) },
  { name: "apply meal plan", run: () => applyGroupMealPlan({ ...selection, arrangementType: "BB", expectedPreviews: [{ reservationId: 1, groupBookingId: "group-1", reservationStatus: "CONFIRMED", currentPlan: "RO", pax: 1, nightsAffected: 1, unitPrice: "100", nightlyAmount: "100", expectedAmount: "100", effectiveDate: "2026-09-29", eligible: true, reason: null }] }) },
  { name: "apply stay fees", run: () => applyGroupStayFees({ ...selection, kinds: ["EARLY_CHECK_IN"] }) },
];

describe.each(actions)("group inclusions: $name", ({ run }) => {
  it.each(["FO", "ADMIN", "GM"])("allows %s to resolve group candidates", async (role) => {
    mocks.auth.mockResolvedValue({ user: { role } });
    await expect(run()).resolves.toEqual({ ok: false, error: "There are no reservations in this group booking." });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { groupBookingId: "group-1" } }));
  });

  it.each([null, "HK", "FB", "ACC", "UNKNOWN"])("rejects %s before reading or writing", async (role) => {
    mocks.auth.mockResolvedValue(role ? { user: { role } } : null);
    await expect(run()).resolves.toEqual({ ok: false, error: "Not authorised" });
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.changeMealPlan).not.toHaveBeenCalled();
    expect(mocks.setStayFee).not.toHaveBeenCalled();
  });
});
