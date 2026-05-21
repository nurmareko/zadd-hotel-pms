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
  quantity: z.coerce
    .number()
    .int()
    .min(1, "Quantity must be at least 1")
    .max(99, "Quantity is too high")
    .default(1),
  notes: z
    .string()
    .trim()
    .max(255, "Notes must be 255 characters or fewer")
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
    .max(255, "Notes must be 255 characters or fewer")
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
