import { z } from "zod";

// Whole-unit limits of Decimal(8,2) quantities and Decimal(12,2) money columns.
const MAX_QUANTITY = 999_999;
const MAX_MONEY = 9_999_999_999;
const idSchema = z.number("ID harus berupa angka").int("ID harus bilangan bulat")
  .min(1, "ID wajib dipilih").max(2_147_483_647, "ID melampaui batas");
const itemSchema = z.object({
  articleId: idSchema,
  quantity: z.number("Jumlah harus berupa angka").int("Jumlah harus bilangan bulat")
    .min(1, "Jumlah minimal 1").max(MAX_QUANTITY, "Jumlah melampaui batas"),
  unitPrice: z.number("Harga harus berupa angka").int("Harga harus dalam rupiah utuh")
    .min(0, "Harga tidak boleh negatif").max(MAX_MONEY, "Harga melampaui batas"),
});

export function calculateGuestLaundryTotal(
  items: readonly { quantity: number; unitPrice: number }[],
): number {
  let total = 0;
  for (const { quantity, unitPrice } of items) {
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY ||
        !Number.isSafeInteger(unitPrice) || unitPrice < 0 || unitPrice > MAX_MONEY ||
        // Bound the product before multiplying so all arithmetic remains exact.
        (unitPrice > 0 && quantity > Math.floor((MAX_MONEY - total) / unitPrice))) {
      throw new RangeError("Total laundry melampaui batas atau nilai item tidak valid.");
    }
    total += quantity * unitPrice;
  }
  return total;
}

export const GuestLaundryOrderSchema = z.object({
  roomId: idSchema,
  items: z.array(itemSchema, "Item laundry tidak valid").min(1, "Pilih minimal satu item laundry"),
  settlementType: z.enum(["CHARGE_TO_ROOM", "DIRECT_TENDER"], "Pilih penyelesaian tagihan"),
  paymentMethod: z.enum(["CASH", "CARD", "TRANSFER", "QRIS"], "Metode pembayaran tidak valid").optional(),
  cashTendered: z.number("Uang diterima harus berupa angka").int("Uang diterima harus dalam rupiah utuh")
    .min(0, "Uang diterima tidak boleh negatif")
    .max(Number.MAX_SAFE_INTEGER, "Uang diterima melampaui batas").optional(),
  notes: z.string("Catatan tidak valid").trim().max(255, "Catatan maksimal 255 karakter").optional(),
}).superRefine((value, ctx) => {
  let total: number;
  try {
    total = calculateGuestLaundryTotal(value.items);
  } catch {
    ctx.addIssue({ code: "custom", path: ["items"], message: "Total laundry melampaui batas atau nilai item tidak valid." });
    return;
  }
  if (value.settlementType === "DIRECT_TENDER") {
    if (!value.paymentMethod) {
      ctx.addIssue({ code: "custom", path: ["paymentMethod"], message: "Pilih metode pembayaran langsung" });
    } else if (value.paymentMethod === "CASH" && (value.cashTendered === undefined || value.cashTendered < total)) {
      ctx.addIssue({ code: "custom", path: ["cashTendered"], message: "Uang diterima harus mencukupi total laundry" });
    }
  }
});

export type GuestLaundryOrderInput = z.infer<typeof GuestLaundryOrderSchema>;
