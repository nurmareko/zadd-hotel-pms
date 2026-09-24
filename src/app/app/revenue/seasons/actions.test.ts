import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), transaction: vi.fn(), revalidate: vi.fn(),
  deleteRule: vi.fn(), roomType: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    pricingRule: { delete: mocks.deleteRule },
    roomType: { findUnique: mocks.roomType },
  },
  TRANSACTION_OPTIONS: {},
}));

import {
  createPricingRule, updatePricingRule, togglePricingRule,
  deletePricingRule, previewPricingSchedule,
} from "./actions";

const id = "clseason000000000000000001";
const input = {
  name: "Libur sekolah", roomTypeId: 1, selectorKind: "DATE_RANGE",
  dayOfWeek: null, startsOn: "2026-09-10", endsBefore: "2026-09-15",
  adjustmentKind: "AMOUNT_DELTA", adjustmentValue: "50000", isActive: true,
};
const weekday = {
  ...input, selectorKind: "DAY_OF_WEEK", dayOfWeek: "MONDAY",
  startsOn: null, endsBefore: null,
};
function transactionClient() {
  return {
    roomType: { findUnique: vi.fn().mockResolvedValue({ baseRate: new Prisma.Decimal(100000) }) },
    pricingRule: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue({
        ...input, id, startsOn: new Date(input.startsOn), endsBefore: new Date(input.endsBefore),
        adjustmentValue: new Prisma.Decimal(input.adjustmentValue),
      }),
      create: vi.fn().mockResolvedValue({ id }),
      update: vi.fn().mockResolvedValue({ id }),
    },
  };
}
let tx: ReturnType<typeof transactionClient>;
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "1", role: "ADMIN" } });
  tx = transactionClient();
  mocks.transaction.mockImplementation(async (callback) => callback(tx));
  mocks.deleteRule.mockResolvedValue({ id });
  mocks.roomType.mockResolvedValue({ id: 1, baseRate: new Prisma.Decimal(100000), pricingRules: [] });
});

const operations = [
  ["create", () => createPricingRule(input)],
  ["update", () => updatePricingRule({ ...input, id })],
  ["toggle", () => togglePricingRule({ id, isActive: true })],
  ["delete", () => deletePricingRule(id)],
  ["preview", () => previewPricingSchedule({ roomTypeId: 1, arrivalDate: input.startsOn, departureDate: input.endsBefore })],
] as const;

describe.each(operations)("season %s permissions", (operation, run) => {
  it.each(["ADMIN", "GM"])("allows %s with the real capability policy", async (role) => {
    mocks.auth.mockResolvedValue({ user: { id: "1", role } });
    expect(await run()).toMatchObject({ ok: true });
    if (operation === "preview") {
      expect(mocks.revalidate).not.toHaveBeenCalled();
    } else {
      expect(mocks.revalidate).toHaveBeenCalledExactlyOnceWith("/app/revenue/seasons");
    }
  });

  it.each(["ACC", "FO", "HK", "FB", null])("denies %s before accessing data", async (role) => {
    mocks.auth.mockResolvedValue(role ? { user: { id: "1", role } } : null);
    expect(await run()).toMatchObject({ ok: false, error: expect.any(String) });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.deleteRule).not.toHaveBeenCalled();
    expect(mocks.roomType).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});

describe.each(["create", "update"] as const)("season %s constraints", (operation) => {
  function save(values: unknown) {
    return operation === "create"
      ? createPricingRule(values)
      : updatePricingRule({ ...(values as typeof input), id });
  }
  function expectNoWrite() {
    expect(tx.pricingRule.create).not.toHaveBeenCalled();
    expect(tx.pricingRule.update).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  }

  it("rejects active date overlap without writing or invalidating cache", async () => {
    tx.pricingRule.findFirst.mockResolvedValue({ id: "another-season" });
    expect(await save(input)).toMatchObject({ ok: false, field: "startsOn" });
    expectNoWrite();
  });

  it("uses half-open overlap boundaries scoped to active ranges and room type, excluding only self on update", async () => {
    expect(await save(input)).toEqual({ ok: true });
    // Strict lt/gt allow touching endpoints in either direction; selector scope
    // permits weekday rules, and room/isActive filters exclude unrelated rules.
    expect(tx.pricingRule.findFirst).toHaveBeenCalledExactlyOnceWith({
      where: {
        roomTypeId: 1, selectorKind: "DATE_RANGE", isActive: true,
        startsOn: { lt: new Date("2026-09-15T00:00:00.000Z") },
        endsBefore: { gt: new Date("2026-09-10T00:00:00.000Z") },
        ...(operation === "update" ? { id: { not: id } } : {}),
      },
      select: { id: true },
    });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    const writer = operation === "create" ? tx.pricingRule.create : tx.pricingRule.update;
    expect(writer).toHaveBeenCalledOnce();
    expect(writer.mock.calls[0][0].data).toMatchObject({
      startsOn: new Date("2026-09-10T00:00:00.000Z"),
      endsBefore: new Date("2026-09-15T00:00:00.000Z"),
      dayOfWeek: null, adjustmentValue: new Prisma.Decimal(50000),
    });
  });

  it("allows an inactive range without querying active overlap", async () => {
    expect(await save({ ...input, isActive: false })).toEqual({ ok: true });
    expect(tx.pricingRule.findFirst).not.toHaveBeenCalled();
  });

  it("rejects duplicate active weekdays", async () => {
    tx.pricingRule.findFirst.mockResolvedValue({ id: "another-season" });
    expect(await save(weekday)).toMatchObject({ ok: false, field: "dayOfWeek" });
    expectNoWrite();
  });

  it.each(["MONDAY", "SUNDAY"])("scopes weekday conflicts to %s, allowing day-disjoint rules", async (dayOfWeek) => {
    expect(await save({ ...weekday, dayOfWeek })).toEqual({ ok: true });
    expect(tx.pricingRule.findFirst).toHaveBeenCalledExactlyOnceWith({
      where: {
        roomTypeId: 1, dayOfWeek, isActive: true,
        ...(operation === "update" ? { id: { not: id } } : {}),
      },
      select: { id: true },
    });
  });

  it.each([
    ["AMOUNT_DELTA", "-100000"], ["AMOUNT_DELTA", "-100001"],
    ["PERCENT_DELTA", "-100"], ["PERCENT_DELTA", "-101"],
    ["AMOUNT_DELTA", "-99999.51"],
  ])("rejects nonpositive rounded rates for %s %s", async (adjustmentKind, adjustmentValue) => {
    expect(await save({ ...input, adjustmentKind, adjustmentValue })).toMatchObject({
      ok: false, field: "adjustmentValue",
    });
    expectNoWrite();
  });

  it.each([
    ["AMOUNT_DELTA", "-99999"], ["AMOUNT_DELTA", "-99999.50"],
    ["PERCENT_DELTA", "-99.99"], ["AMOUNT_DELTA", "0"],
  ])("allows positive final rates for %s %s", async (adjustmentKind, adjustmentValue) => {
    expect(await save({ ...input, adjustmentKind, adjustmentValue })).toEqual({ ok: true });
  });

  it("still validates the final rate for inactive rules", async () => {
    expect(await save({ ...input, isActive: false, adjustmentValue: "-100000" })).toMatchObject({
      ok: false, field: "adjustmentValue",
    });
    expectNoWrite();
  });

  it("rejects missing room types", async () => {
    tx.roomType.findUnique.mockResolvedValue(null);
    expect(await save(input)).toMatchObject({ ok: false, field: "roomTypeId" });
    expectNoWrite();
  });

  it("rejects invalid input before opening a transaction", async () => {
    expect(await save({ ...input, endsBefore: input.startsOn })).toMatchObject({ ok: false, field: "endsBefore" });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expectNoWrite();
  });
});

describe("season update and activation", () => {
  it("rejects an update when the season no longer exists", async () => {
    tx.pricingRule.findUnique.mockResolvedValue(null);
    expect(await updatePricingRule({ ...input, id })).toMatchObject({ ok: false });
    expect(tx.pricingRule.update).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("rechecks overlap when activating, excluding itself", async () => {
    tx.pricingRule.findFirst.mockResolvedValue({ id: "another-season" });
    expect(await togglePricingRule({ id, isActive: true })).toMatchObject({ ok: false, field: "startsOn" });
    expect(tx.pricingRule.findFirst.mock.calls[0][0].where.id).toEqual({ not: id });
    expect(tx.pricingRule.update).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it.each(["-100000", "-100001", "-99999.51"])(
    "allows disabling a legacy rule with a nonpositive rate: %s",
    async (adjustmentValue) => {
      tx.pricingRule.findUnique.mockResolvedValue({
        ...input, id,
        startsOn: new Date(input.startsOn),
        endsBefore: new Date(input.endsBefore),
        adjustmentValue: new Prisma.Decimal(adjustmentValue),
      });
      expect(await togglePricingRule({ id, isActive: false })).toEqual({ ok: true });
      expect(tx.pricingRule.update).toHaveBeenCalledWith({ where: { id }, data: { isActive: false } });
      expect(mocks.revalidate).toHaveBeenCalledExactlyOnceWith("/app/revenue/seasons");
    },
  );

  it.each(["-100000", "-100001", "-99999.51"])(
    "rejects activation of a nonpositive rate: %s",
    async (adjustmentValue) => {
      tx.pricingRule.findUnique.mockResolvedValue({
        ...input, id, isActive: false,
        startsOn: new Date(input.startsOn),
        endsBefore: new Date(input.endsBefore),
        adjustmentValue: new Prisma.Decimal(adjustmentValue),
      });
      expect(await togglePricingRule({ id, isActive: true })).toMatchObject({ ok: false, field: "adjustmentValue" });
      expect(tx.pricingRule.update).not.toHaveBeenCalled();
      expect(mocks.revalidate).not.toHaveBeenCalled();
    },
  );

  it("allows deactivation without an overlap check", async () => {
    expect(await togglePricingRule({ id, isActive: false })).toEqual({ ok: true });
    expect(tx.pricingRule.findFirst).not.toHaveBeenCalled();
    expect(tx.pricingRule.update).toHaveBeenCalledWith({ where: { id }, data: { isActive: false } });
    expect(mocks.revalidate).toHaveBeenCalledExactlyOnceWith("/app/revenue/seasons");
  });
});
