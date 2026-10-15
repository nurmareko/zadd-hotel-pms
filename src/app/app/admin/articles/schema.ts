import { ArticleType } from "@prisma/client";
import { z } from "zod";

export const articleTypes = [
  ArticleType.ROOM,
  ArticleType.FB,
  ArticleType.SERVICE,
  ArticleType.TAX,
  ArticleType.MISC,
] as const;

const formNumber = (schema: z.ZodNumber) =>
  z.preprocess(
    (value) =>
      (typeof value === "string" && value.trim() === "") ||
      value === null ||
      typeof value === "undefined"
        ? undefined
        : Number(value),
    schema,
  );

export const ArticleCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(20, "Code must not exceed 20 characters")
    .regex(
      /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/,
      "Code must contain only uppercase letters, numbers and hyphens",
    ),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .min(2, "Name must contain at least 2 characters")
    .max(100, "Name must not exceed 100 characters"),
  type: z.enum(articleTypes, { error: "Select a valid article category" }),
  defaultPrice: formNumber(
    z
      .number({ error: "Default price is required and must be a number" })
      .min(0, "Default price cannot be negative"),
  ),
});

export const ArticleUpdateSchema = ArticleCreateSchema.extend({
  id: z.coerce.number().int().positive("Select an article"),
});

export const ArticleIdSchema = z.object({
  id: z.coerce.number().int().positive("Select an article"),
});

export type ArticleTypeValue = (typeof articleTypes)[number];
