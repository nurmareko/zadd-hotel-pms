import { describe, expect, it } from "vitest";
import { MealPlanPricesSchema } from "./schema";

describe("meal-plan catalog validation", () => {
  it("accepts zero and whole IDR from numeric inputs or form strings", () => {
    expect(MealPlanPricesSchema.parse({ BB: "0", HB: 180000, FB: "300000" }))
      .toEqual({ BB: 0, HB: 180000, FB: 300000 });
  });
  it.each([-1, 0.5, "1.5", "", "  ", null, undefined, true, NaN, Infinity, 10_000_000_000])(
    "rejects invalid or out-of-column-range price %s", (BB) => {
      expect(MealPlanPricesSchema.safeParse({ BB, HB: 150000, FB: 250000 }).success).toBe(false);
    },
  );
  it("explains the IDR price limit in English", () => {
    const result = MealPlanPricesSchema.safeParse({ BB: 10_000_000_000, HB: 150000, FB: 250000 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: ["BB"], message: "Maximum price is IDR 9,999,999,999" }),
      ]));
    }
  });
  it("requires all three prices", () => {
    expect(MealPlanPricesSchema.safeParse({ BB: 50000 }).success).toBe(false);
  });
});
