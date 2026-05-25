import { PaymentMethod } from "@prisma/client";
import { z } from "zod";

export const CreateOrderSchema = z.object({
  tableId: z.coerce.number().int().positive("Table is required"),
  guestCount: z.coerce
    .number()
    .int()
    .min(1, "Guest count must be at least 1")
    .max(99, "Guest count is too high"),
});

export const AddItemToOrderSchema = z.object({
  orderId: z.coerce.number().int().positive("Order is required"),
  menuItemId: z.coerce.number().int().positive("Menu item is required"),
  guestNumber: z.coerce
    .number()
    .int()
    .min(1, "Guest number must be at least 1")
    .max(99, "Guest number is too high")
    .default(1),
  quantity: z.coerce
    .number()
    .int()
    .min(1, "Quantity must be at least 1")
    .max(99, "Quantity is too high")
    .default(1),
  notes: z
    .string()
    .trim()
    .max(235, "Notes must be 235 characters or fewer")
    .optional()
    .transform((value) => value || null),
});

export const OrderItemIdSchema = z.object({
  orderItemId: z.coerce.number().int().positive("Order item is required"),
});

export const UpdateItemQuantitySchema = OrderItemIdSchema.extend({
  quantity: z.coerce
    .number()
    .int()
    .min(0, "Quantity cannot be negative")
    .max(99, "Quantity is too high"),
});

export const UpdateItemNotesSchema = OrderItemIdSchema.extend({
  notes: z
    .string()
    .trim()
    .max(235, "Notes must be 235 characters or fewer")
    .optional()
    .transform((value) => value || null),
});

export const VoidOrderSchema = z.object({
  orderId: z.coerce.number().int().positive("Order is required"),
  reason: z
    .string()
    .trim()
    .min(1, "Void reason is required")
    .max(255, "Void reason must be 255 characters or fewer"),
});

const OptionalPaymentReferenceSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.string().max(100, "Reference must be 100 characters or fewer").optional(),
);

export const directPaymentMethods = [
  PaymentMethod.CASH,
  PaymentMethod.CARD,
  PaymentMethod.TRANSFER,
] as const;

export const PayOrderDirectSchema = z
  .object({
    orderId: z.coerce.number().int().positive("Order is required"),
    method: z.enum(directPaymentMethods),
    amountTendered: z.coerce.number().optional(),
    reference: OptionalPaymentReferenceSchema,
  })
  .superRefine((value, ctx) => {
    if (
      value.method === PaymentMethod.CASH &&
      (value.amountTendered === undefined || value.amountTendered < 0)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["amountTendered"],
        message: "Uang diterima harus diisi untuk pembayaran tunai",
      });
    }
  });

export const ChargeOrderToRoomSchema = z.object({
  orderId: z.coerce.number().int().positive("Order is required"),
  roomNumber: z
    .string()
    .trim()
    .min(1, "Nomor kamar harus diisi")
    .max(10, "Nomor kamar terlalu panjang"),
});

export const LookupRoomForChargeSchema = z.object({
  roomNumber: z
    .string()
    .trim()
    .min(1, "Nomor kamar harus diisi")
    .max(10, "Nomor kamar terlalu panjang"),
});
