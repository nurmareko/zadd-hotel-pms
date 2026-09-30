import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), findMany: vi.fn(), changeMealPlan: vi.fn(), setStayFee: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { reservation: { findMany: mocks.findMany } } }));
vi.mock("@/lib/reservation-inclusions/actions", () => ({ changeReservationMealPlan: mocks.changeMealPlan, setReservationStayFee: mocks.setStayFee }));

import { applyGroupMealPlan, applyGroupStayFees, previewGroupMealPlan } from "./inclusion-actions";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findMany.mockResolvedValue([]);
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
    await expect(run()).resolves.toEqual({ ok: false, error: "Tidak ada reservasi dalam booking grup ini." });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { groupBookingId: "group-1" } }));
  });

  it.each([null, "HK", "FB", "ACC", "UNKNOWN"])("rejects %s before reading or writing", async (role) => {
    mocks.auth.mockResolvedValue(role ? { user: { role } } : null);
    await expect(run()).resolves.toEqual({ ok: false, error: "Tidak diizinkan" });
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.changeMealPlan).not.toHaveBeenCalled();
    expect(mocks.setStayFee).not.toHaveBeenCalled();
  });
});
