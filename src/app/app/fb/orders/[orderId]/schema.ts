import { PaymentMethod } from "@prisma/client";
import { z } from "zod";

export const CreateOrderSchema = z.object({
  tableId: z.coerce.number().int().positive("Meja wajib dipilih"),
  guestCount: z.coerce
    .number()
    .int()
    .min(1, "Jumlah tamu minimal 1")
    .max(99, "Jumlah tamu terlalu banyak"),
});

export const CreateRoomServiceOrderSchema = z.object({
  roomNumber: z
    .string()
    .trim()
    .min(1, "Nomor kamar harus diisi")
    .max(10, "Nomor kamar terlalu panjang"),
  guestCount: z.coerce
    .number()
    .int()
    .min(1, "Jumlah tamu minimal 1")
    .max(99, "Jumlah tamu terlalu banyak"),
});

export const AddItemToOrderSchema = z.object({
  orderId: z.coerce.number().int().positive("Order wajib dipilih"),
  menuItemId: z.coerce.number().int().positive("Item menu wajib dipilih"),
  guestNumber: z.coerce
    .number()
    .int()
    .min(1, "Nomor tamu minimal 1")
    .max(99, "Nomor tamu terlalu besar")
    .default(1),
  quantity: z.coerce
    .number()
    .int()
    .min(1, "Jumlah minimal 1")
    .max(99, "Jumlah terlalu banyak")
    .default(1),
  notes: z
    .string()
    .trim()
    .max(235, "Catatan maksimal 235 karakter")
    .optional()
    .transform((value) => value || null),
});

export const OrderItemIdSchema = z.object({
  orderItemId: z.coerce.number().int().positive("Item order wajib dipilih"),
});

export const UpdateItemQuantitySchema = OrderItemIdSchema.extend({
  quantity: z.coerce
    .number()
    .int()
    .min(0, "Jumlah tidak boleh negatif")
    .max(99, "Jumlah terlalu banyak"),
});

export const UpdateItemNotesSchema = OrderItemIdSchema.extend({
  notes: z
    .string()
    .trim()
    .max(235, "Catatan maksimal 235 karakter")
    .optional()
    .transform((value) => value || null),
});

export const VoidOrderSchema = z.object({
  orderId: z.coerce.number().int().positive("Order wajib dipilih"),
  reason: z
    .string()
    .trim()
    .min(1, "Alasan pembatalan wajib diisi")
    .max(255, "Alasan pembatalan maksimal 255 karakter"),
});

const OptionalPaymentReferenceSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.string().max(100, "Referensi maksimal 100 karakter").optional(),
);

export const directPaymentMethods = [
  PaymentMethod.CASH,
  PaymentMethod.CARD,
  PaymentMethod.TRANSFER,
] as const;

const PaymentSelectionItemSchema = z.object({
  orderItemId: z.coerce.number().int().positive("Item order wajib dipilih"),
  quantity: z.coerce
    .number()
    .int()
    .min(1, "Jumlah minimal 1")
    .max(99, "Jumlah terlalu banyak"),
});

export const PayOrderDirectSchema = z
  .object({
    orderId: z.coerce.number().int().positive("Order wajib dipilih"),
    method: z.enum(directPaymentMethods),
    amountTendered: z.coerce.number().optional(),
    reference: OptionalPaymentReferenceSchema,
    selectedItems: z
      .array(PaymentSelectionItemSchema)
      .min(1, "Pilih minimal satu item untuk dibayar"),
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
  orderId: z.coerce.number().int().positive("Order wajib dipilih"),
  roomNumber: z
    .string()
    .trim()
    .max(10, "Nomor kamar terlalu panjang")
    .optional()
    .transform((value) => value || undefined),
  selectedItems: z
    .array(PaymentSelectionItemSchema)
    .min(1, "Pilih minimal satu item untuk dibayar"),
});

export const LookupRoomForChargeSchema = z.object({
  roomNumber: z
    .string()
    .trim()
    .min(1, "Nomor kamar harus diisi")
    .max(10, "Nomor kamar terlalu panjang"),
});
