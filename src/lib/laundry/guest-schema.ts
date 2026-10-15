import { z } from "zod";

// Whole-unit limits of Decimal(8,2) quantities and Decimal(12,2) money columns.
const MAX_QUANTITY = 999_999;
const MAX_MONEY = 9_999_999_999;
const idSchema = z.number("ID must be a number").int("ID must be a whole number")
  .min(1, "Select an ID").max(2_147_483_647, "ID exceeds the limit");
const itemSchema = z.object({
  articleId: idSchema,
  quantity: z.number("Amount must be a number").int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1").max(MAX_QUANTITY, "Quantity exceeds the limit"),
  unitPrice: z.number("Price must be a number").int("Price must be in whole IDR")
    .min(0, "Price must not be negative").max(MAX_MONEY, "Price exceeds the limit"),
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
      throw new RangeError("The laundry total exceeds the limit or an item value is invalid.");
    }
    total += quantity * unitPrice;
  }
  return total;
}

export const GuestLaundryOrderSchema = z.object({
  roomId: idSchema,
  items: z.array(itemSchema, "Invalid laundry item").min(1, "Select at least one laundry item"),
  settlementType: z.enum(["CHARGE_TO_ROOM", "DIRECT_TENDER"], "Select a settlement type"),
  paymentMethod: z.enum(["CASH", "CARD", "TRANSFER"], "Invalid payment method").optional(),
  cashTendered: z.number("Cash received must be a number").int("Cash received must be in whole IDR")
    .min(0, "Cash received must not be negative")
    .max(Number.MAX_SAFE_INTEGER, "Cash received exceeds the limit").optional(),
  notes: z.string("Invalid notes").trim().max(255, "Notes must be at most 255 characters").optional(),
}).superRefine((value, ctx) => {
  let total: number;
  try {
    total = calculateGuestLaundryTotal(value.items);
  } catch {
    ctx.addIssue({ code: "custom", path: ["items"], message: "The laundry total exceeds the limit or an item value is invalid." });
    return;
  }
  if (value.settlementType === "DIRECT_TENDER") {
    if (!value.paymentMethod) {
      ctx.addIssue({ code: "custom", path: ["paymentMethod"], message: "Select a direct payment method" });
    } else if (value.paymentMethod === "CASH" && (value.cashTendered === undefined || value.cashTendered < total)) {
      ctx.addIssue({ code: "custom", path: ["cashTendered"], message: "Cash received must cover the laundry total" });
    }
  }
});

export type GuestLaundryOrderInput = z.infer<typeof GuestLaundryOrderSchema>;
