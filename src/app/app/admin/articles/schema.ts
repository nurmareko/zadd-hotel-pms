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
    .min(1, "Kode wajib diisi")
    .max(20, "Kode maksimal 20 karakter")
    .regex(
      /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/,
      "Kode harus huruf besar, angka, dan tanda hubung",
    ),
  name: z
    .string()
    .trim()
    .min(1, "Nama wajib diisi")
    .min(2, "Nama minimal 2 karakter")
    .max(100, "Nama maksimal 100 karakter"),
  type: z.enum(articleTypes, { error: "Pilih kategori artikel yang valid" }),
  defaultPrice: formNumber(
    z
      .number({ error: "Default price wajib diisi dan harus berupa angka" })
      .min(0, "Default price tidak boleh negatif"),
  ),
});

export const ArticleUpdateSchema = ArticleCreateSchema.extend({
  id: z.coerce.number().int().positive("Artikel wajib dipilih"),
});

export const ArticleIdSchema = z.object({
  id: z.coerce.number().int().positive("Artikel wajib dipilih"),
});

export type ArticleTypeValue = (typeof articleTypes)[number];
