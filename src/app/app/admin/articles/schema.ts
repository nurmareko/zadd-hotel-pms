import { ArticleType } from "@prisma/client";
import { z } from "zod";

export const articleTypes = [
  ArticleType.ROOM,
  ArticleType.FB,
  ArticleType.SERVICE,
  ArticleType.TAX,
  ArticleType.MISC,
] as const;

const OptionalDefaultPriceSchema = z.preprocess(
  (value) =>
    value === "" || value === null || typeof value === "undefined"
      ? null
      : value,
  z.coerce
    .number("Default price must be a number")
    .min(0, "Default price must be at least 0")
    .nullable(),
);

export const ArticleCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(20, "Code must be 20 characters or fewer")
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Code may only contain letters, numbers, underscores, and hyphens",
    )
    .transform((value) => value.toUpperCase()),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or fewer"),
  type: z.enum(articleTypes),
  defaultPrice: OptionalDefaultPriceSchema,
});

export const ArticleUpdateSchema = ArticleCreateSchema.extend({
  id: z.coerce.number().int().positive("Article is required"),
});

export const ArticleIdSchema = z.object({
  id: z.coerce.number().int().positive("Article is required"),
});

export type ArticleTypeValue = (typeof articleTypes)[number];
export type ArticleCreateInput = z.input<typeof ArticleCreateSchema>;
export type ArticleCreateValues = z.output<typeof ArticleCreateSchema>;
