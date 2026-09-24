import { z } from "zod";

const price = z.preprocess(
  (value) => typeof value === "string" && /^\d+$/.test(value.trim())
    ? Number(value.trim()) : value,
  z.number({ error: "Harga wajib berupa angka bulat nonnegatif" })
    .int("Harga wajib berupa angka bulat")
    .min(0, "Harga tidak boleh negatif")
    .max(9_999_999_999, "Harga maksimal Rp 9.999.999.999"),
);

export const MealPlanPricesSchema = z.object({ BB: price, HB: price, FB: price });
