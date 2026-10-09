import { PaymentMethod, Prisma } from "@prisma/client";
import { z } from "zod";

const OptionalDescriptionSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.string().max(255, "Deskripsi maksimal 255 karakter").optional(),
);

const OptionalReferenceSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.string().max(100, "Referensi maksimal 100 karakter").optional(),
);

export const PostChargeSchema = z.object({
  folioId: z.coerce.number().int().positive("Folio wajib dipilih"),
  articleId: z.coerce.number().int().positive("Artikel wajib dipilih"),
  description: OptionalDescriptionSchema,
  quantity: z.coerce
    .number("Jumlah harus berupa angka")
    .min(0.01, "Jumlah minimal 0.01"),
  unitPrice: z.coerce
    .number("Harga satuan harus berupa angka")
    .int("Harga satuan harus dalam rupiah utuh")
    .min(-100_000_000, "Harga satuan minimal -100.000.000")
        .max(100_000_000, "Harga satuan maksimal 100.000.000")
        .refine((value) => value !== 0, "Harga satuan tidak boleh 0"),
}).superRefine((value, ctx) => {
  if (value.unitPrice < 0 && (value.description?.length ?? 0) < 3) {
    ctx.addIssue({
      code: "custom",
      path: ["description"],
      message: "Alasan koreksi wajib diisi minimal 3 karakter",
    });
  }

  if (!new Prisma.Decimal(value.quantity).mul(value.unitPrice).isInteger()) {
    ctx.addIssue({
      code: "custom",
      path: ["quantity"],
      message: "Total tagihan harus dalam rupiah utuh",
    });
  }
});

export const paymentMethods = [
  PaymentMethod.CASH,
  PaymentMethod.TRANSFER,
  PaymentMethod.CARD,
] as const;

export const PaymentSchema = z
  .object({
    folioId: z.coerce.number().int().positive("Folio wajib dipilih"),
    amount: z.coerce
      .number("Jumlah harus berupa angka")
      .int("Jumlah harus dalam rupiah utuh")
      .positive("Jumlah harus lebih dari 0"),
    method: z.enum(paymentMethods),
    reference: OptionalReferenceSchema,
  })
  .superRefine((value, ctx) => {
    if (value.method === PaymentMethod.TRANSFER && !value.reference) {
      ctx.addIssue({
        code: "custom",
        path: ["reference"],
        message: "Referensi wajib diisi untuk pembayaran transfer",
      });
    }
  });
