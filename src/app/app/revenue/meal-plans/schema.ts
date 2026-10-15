import { z } from "zod";

const price = z.preprocess(
  (value) => typeof value === "string" && /^\d+$/.test(value.trim())
    ? Number(value.trim()) : value,
  z.number({ error: "Price must be a non-negative whole number" })
    .int("Price must be a whole number")
    .min(0, "Price cannot be negative")
    .max(9_999_999_999, "Maximum price is IDR 9,999,999,999"),
);

export const MealPlanPricesSchema = z.object({ BB: price, HB: price, FB: price });
