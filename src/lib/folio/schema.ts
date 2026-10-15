import { PaymentMethod, Prisma } from "@prisma/client";
import { z } from "zod";

const OptionalDescriptionSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.string().max(255, "Description must be at most 255 characters").optional(),
);

const OptionalReferenceSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.string().max(100, "Reference must be at most 100 characters").optional(),
);

export const PostChargeSchema = z.object({
  folioId: z.coerce.number().int().positive("Select a folio"),
  articleId: z.coerce.number().int().positive("Select an article"),
  description: OptionalDescriptionSchema,
  quantity: z.coerce
    .number("Amount must be a number")
    .min(0.01, "Quantity must be at least 0.01"),
  unitPrice: z.coerce
    .number("Unit price must be a number")
    .int("Unit price must be in whole IDR")
    .min(-100_000_000, "Unit price must be at least -100,000,000")
        .max(100_000_000, "Unit price must be at most 100,000,000")
        .refine((value) => value !== 0, "Unit price must not be 0"),
}).superRefine((value, ctx) => {
  if (value.unitPrice < 0 && (value.description?.length ?? 0) < 3) {
    ctx.addIssue({
      code: "custom",
      path: ["description"],
      message: "A correction reason of at least 3 characters is required",
    });
  }

  if (!new Prisma.Decimal(value.quantity).mul(value.unitPrice).isInteger()) {
    ctx.addIssue({
      code: "custom",
      path: ["quantity"],
      message: "Total charge must be in whole IDR",
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
    folioId: z.coerce.number().int().positive("Select a folio"),
    amount: z.coerce
      .number("Amount must be a number")
      .int("Amount must be in whole IDR")
      .positive("Amount must be greater than 0"),
    method: z.enum(paymentMethods),
    reference: OptionalReferenceSchema,
  })
  .superRefine((value, ctx) => {
    if (value.method === PaymentMethod.TRANSFER && !value.reference) {
      ctx.addIssue({
        code: "custom",
        path: ["reference"],
        message: "A reference is required for bank transfers",
      });
    }
  });
