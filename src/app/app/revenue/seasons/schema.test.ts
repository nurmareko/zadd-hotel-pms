import { describe, expect, it } from "vitest";
import {
  PricingPreviewSchema,
  PricingRuleCreateSchema,
  PricingRuleUpdateSchema,
  pricingRuleDays,
} from "./schema";

const range = {
  name: "Libur sekolah",
  roomTypeId: 1,
  selectorKind: "DATE_RANGE",
  startsOn: "2026-09-10",
  endsBefore: "2026-09-15",
  dayOfWeek: null,
  adjustmentKind: "AMOUNT_DELTA",
  adjustmentValue: "50000",
  isActive: true,
};
const weekday = {
  ...range,
  selectorKind: "DAY_OF_WEEK",
  dayOfWeek: "MONDAY",
  startsOn: null,
  endsBefore: null,
};

function expectFieldFailure(input: unknown, field: string) {
  const result = PricingRuleCreateSchema.safeParse(input);
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: [field] })]),
    );
  }
}

describe("season date-range schema", () => {
  it("accepts a range and normalizes form values", () => {
    expect(PricingRuleCreateSchema.parse({
      ...range, name: "  Libur sekolah  ", roomTypeId: "1", dayOfWeek: "", isActive: "false",
    })).toEqual({ ...range, isActive: false });
  });

  it.each(["2026-09-10", "2026-09-09"])("rejects nonpositive range ending %s", (endsBefore) => {
    expectFieldFailure({ ...range, endsBefore }, "endsBefore");
  });

  it.each(["startsOn", "endsBefore"])("requires %s", (field) => {
    expectFieldFailure({ ...range, [field]: "" }, "startsOn");
  });

  it.each(["2026-02-29", "2026-04-31", "2026-13-01", "10/09/2026"])("rejects invalid date %s", (date) => {
    expectFieldFailure({ ...range, startsOn: date }, "startsOn");
    expectFieldFailure({ ...range, endsBefore: date }, "endsBefore");
  });

  it("accepts a one-night leap-day range", () => {
    expect(PricingRuleCreateSchema.safeParse({
      ...range, startsOn: "2028-02-29", endsBefore: "2028-03-01",
    }).success).toBe(true);
  });

  it("forbids combining a range with a weekday", () => {
    expectFieldFailure({ ...range, dayOfWeek: "MONDAY" }, "startsOn");
  });

  it("applies range validation to updates too", () => {
    const result = PricingRuleUpdateSchema.safeParse({
      ...range, id: "clseason000000000000000001", endsBefore: range.startsOn,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(["endsBefore"]);
  });
});

describe("season weekday schema", () => {
  it.each(pricingRuleDays)("accepts %s without dates", (dayOfWeek) => {
    expect(PricingRuleCreateSchema.safeParse({ ...weekday, dayOfWeek }).success).toBe(true);
  });

  it.each([null, "", "FUNDAY"])("rejects missing or invalid weekday %s", (dayOfWeek) => {
    expectFieldFailure({ ...weekday, dayOfWeek }, "dayOfWeek");
  });

  it.each(["startsOn", "endsBefore"])("forbids weekday with %s", (field) => {
    expectFieldFailure({ ...weekday, [field]: "2026-09-10" }, "dayOfWeek");
  });
});

describe("season adjustment schema", () => {
  it.each(["AMOUNT_DELTA", "PERCENT_DELTA"])("accepts signed %s adjustments (final-rate positivity belongs to actions)", (adjustmentKind) => {
    for (const adjustmentValue of ["50000", "0", "-10", "12.50", "-99.99"]) {
      expect(PricingRuleCreateSchema.safeParse({ ...range, adjustmentKind, adjustmentValue }).success).toBe(true);
    }
  });

  it.each(["", "NaN", "Infinity", "1e3", "1.234", "10000000000", "1,000"])("rejects malformed adjustment %s", (adjustmentValue) => {
    expectFieldFailure({ ...range, adjustmentValue }, "adjustmentValue");
  });

  it.each([0, -1, 1.5])("rejects invalid room type %s", (roomTypeId) => {
    expectFieldFailure({ ...range, roomTypeId }, "roomTypeId");
  });
});

describe("season preview schema", () => {
  it.each([
    ["2026-09-10", "2026-09-11", true],
    ["2026-09-10", "2026-09-10", false],
    ["2026-09-10", "2026-09-09", false],
    ["2028-01-01", "2029-01-01", true],
    ["2028-01-01", "2029-01-02", false],
    ["2026-02-29", "2026-03-02", false],
  ])("validates preview %s to %s: %s", (arrivalDate, departureDate, valid) => {
    expect(PricingPreviewSchema.safeParse({ roomTypeId: 1, arrivalDate, departureDate }).success).toBe(valid);
  });
});
