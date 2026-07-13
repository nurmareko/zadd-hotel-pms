import { ArticleType, PaymentMethod, Prisma } from "@prisma/client";
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
    .min(0, "Harga satuan minimal 0"),
}).superRefine((value, ctx) => {
  if (!new Prisma.Decimal(value.quantity).mul(value.unitPrice).isInteger()) {
    ctx.addIssue({
      code: "custom",
      path: ["quantity"],
      message: "Total charge harus dalam rupiah utuh",
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

export type PostChargeValues = z.output<typeof PostChargeSchema>;
export type PaymentValues = z.output<typeof PaymentSchema>;

export const nonPostableArticleTypes = [ArticleType.TAX] as const;
