import { PaymentMethod } from "@prisma/client";
import { z } from "zod";

export const CreateOrderSchema = z.object({
  tableId: z.coerce.number().int().positive("Select a table"),
  guestCount: z.coerce
    .number()
    .int()
    .min(1, "At least 1 guest is required")
    .max(99, "Too many guests"),
});

export const CreateRoomServiceOrderSchema = z.object({
  roomNumber: z
    .string()
    .trim()
    .min(1, "A room number is required")
    .max(10, "The room number is too long"),
  guestCount: z.coerce
    .number()
    .int()
    .min(1, "At least 1 guest is required")
    .max(99, "Too many guests"),
});

export const AddItemToOrderSchema = z.object({
  orderId: z.coerce.number().int().positive("Select an order"),
  menuItemId: z.coerce.number().int().positive("Select a menu item"),
  guestNumber: z.coerce
    .number()
    .int()
    .min(1, "The guest number must be at least 1")
    .max(99, "The guest number is too high")
    .default(1),
  quantity: z.coerce
    .number()
    .int()
    .min(1, "The quantity must be at least 1")
    .max(99, "The quantity is too high")
    .default(1),
  notes: z
    .string()
    .trim()
    .max(235, "Notes must not exceed 235 characters")
    .optional()
    .transform((value) => value || null),
});

export const OrderItemIdSchema = z.object({
  orderItemId: z.coerce.number().int().positive("Select an order item"),
});

export const UpdateItemQuantitySchema = OrderItemIdSchema.extend({
  quantity: z.coerce
    .number()
    .int()
    .min(0, "The quantity cannot be negative")
    .max(99, "The quantity is too high"),
});

export const UpdateItemNotesSchema = OrderItemIdSchema.extend({
  notes: z
    .string()
    .trim()
    .max(235, "Notes must not exceed 235 characters")
    .optional()
    .transform((value) => value || null),
});

export const VoidOrderSchema = z.object({
  orderId: z.coerce.number().int().positive("Select an order"),
  reason: z
    .string()
    .trim()
    .min(1, "A reason for voiding is required")
    .max(255, "The reason for voiding must not exceed 255 characters"),
});

const OptionalPaymentReferenceSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.string().max(100, "The reference must not exceed 100 characters").optional(),
);

export const directPaymentMethods = [
  PaymentMethod.CASH,
  PaymentMethod.CARD,
  PaymentMethod.TRANSFER,
] as const;

const PaymentSelectionItemSchema = z.object({
  orderItemId: z.coerce.number().int().positive("Select an order item"),
  quantity: z.coerce
    .number()
    .int()
    .min(1, "The quantity must be at least 1")
    .max(99, "The quantity is too high"),
});

export const PayOrderDirectSchema = z
  .object({
    orderId: z.coerce.number().int().positive("Select an order"),
    method: z.enum(directPaymentMethods),
    amountTendered: z.coerce
      .number()
      .int("The amount received must be in whole rupiah")
      .optional(),
    reference: OptionalPaymentReferenceSchema,
    selectedItems: z
      .array(PaymentSelectionItemSchema)
      .min(1, "Select at least one item to pay"),
  })
  .superRefine((value, ctx) => {
    if (
      value.method === PaymentMethod.CASH &&
      (value.amountTendered === undefined || value.amountTendered < 0)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["amountTendered"],
        message: "The amount received is required for cash payments",
      });
    }
  });

export const ChargeOrderToRoomSchema = z.object({
  orderId: z.coerce.number().int().positive("Select an order"),
  roomNumber: z
    .string()
    .trim()
    .max(10, "The room number is too long")
    .optional()
    .transform((value) => value || undefined),
  selectedItems: z
    .array(PaymentSelectionItemSchema)
    .min(1, "Select at least one item to pay"),
});

export const LookupRoomForChargeSchema = z.object({
  roomNumber: z
    .string()
    .trim()
    .min(1, "A room number is required")
    .max(10, "The room number is too long"),
});
