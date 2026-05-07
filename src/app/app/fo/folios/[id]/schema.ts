import { ArticleType, PaymentMethod } from "@prisma/client";
import { z } from "zod";

const OptionalDescriptionSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.string().max(255, "Description must be 255 characters or fewer").optional(),
);

const OptionalReferenceSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.string().max(100, "Reference must be 100 characters or fewer").optional(),
);

export const PostChargeSchema = z.object({
  folioId: z.coerce.number().int().positive("Folio is required"),
  articleId: z.coerce.number().int().positive("Article is required"),
  description: OptionalDescriptionSchema,
  quantity: z.coerce
    .number("Quantity must be a number")
    .min(0.01, "Quantity must be at least 0.01"),
  unitPrice: z.coerce
    .number("Unit price must be a number")
    .min(0, "Unit price must be at least 0"),
});

export const paymentMethods = [
  PaymentMethod.CASH,
  PaymentMethod.TRANSFER,
  PaymentMethod.CARD,
] as const;

export const PaymentSchema = z
  .object({
    folioId: z.coerce.number().int().positive("Folio is required"),
    amount: z.coerce
      .number("Amount must be a number")
      .positive("Amount must be greater than 0"),
    method: z.enum(paymentMethods),
    reference: OptionalReferenceSchema,
  })
  .superRefine((value, ctx) => {
    if (value.method === PaymentMethod.TRANSFER && !value.reference) {
      ctx.addIssue({
        code: "custom",
        path: ["reference"],
        message: "Reference is required for transfer payments",
      });
    }
  });

export type PostChargeValues = z.output<typeof PostChargeSchema>;
export type PaymentValues = z.output<typeof PaymentSchema>;

export const nonPostableArticleTypes = [ArticleType.TAX] as const;
