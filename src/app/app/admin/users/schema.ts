import { z } from "zod";

export const roleCodes = ["FO", "HK", "FB", "ACC", "ADMIN"] as const;

export type RoleCode = (typeof roleCodes)[number];

const OptionalEmailSchema = z
  .preprocess(
    (value) =>
      value === null ||
      typeof value === "undefined" ||
      (typeof value === "string" && value.trim() === "")
        ? null
        : value,
    z
      .string()
      .trim()
      .max(100, "Email maksimal 100 karakter")
      .email("Format email tidak valid")
      .nullable(),
  )
  .transform((value) => value ?? null);

const UserBaseSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Username wajib diisi")
    .min(3, "Username minimal 3 karakter")
    .max(50, "Username maksimal 50 karakter")
    .regex(/^[A-Za-z0-9_]+$/, "Username hanya boleh huruf, angka, dan underscore"),
  fullName: z
    .string()
    .trim()
    .min(1, "Nama lengkap wajib diisi")
    .min(2, "Nama lengkap minimal 2 karakter")
    .max(100, "Nama lengkap maksimal 100 karakter"),
  email: OptionalEmailSchema,
  role: z.enum(roleCodes, { error: "Pilih role yang valid" }),
});

const PasswordSchema = z
  .string()
  .min(1, "Password wajib diisi")
  .min(8, "Password minimal 8 karakter")
  .max(100, "Password maksimal 100 karakter");

export const UserCreateSchema = UserBaseSchema.extend({
  password: PasswordSchema,
});

export const UserUpdateSchema = UserBaseSchema.extend({
  id: z.coerce.number().int().positive("Pengguna wajib dipilih"),
  password: z.union([PasswordSchema, z.literal("")]).optional(),
});

export const UserIdSchema = z.object({
  id: z.coerce.number().int().positive("Pengguna wajib dipilih"),
});

export const UserPasswordResetSchema = z.object({
  id: z.coerce.number().int().positive("Pengguna wajib dipilih"),
  password: PasswordSchema,
});

export type UserCreateInput = z.input<typeof UserCreateSchema>;
export type UserCreateValues = z.output<typeof UserCreateSchema>;
export type UserUpdateInput = z.input<typeof UserUpdateSchema>;
export type UserUpdateValues = z.output<typeof UserUpdateSchema>;
