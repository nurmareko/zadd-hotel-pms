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
      .max(100, "Email must not exceed 100 characters")
      .email("Invalid email format")
      .nullable(),
  )
  .transform((value) => value ?? null);

const UserBaseSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Username is required")
    .min(3, "Username must contain at least 3 characters")
    .max(50, "Username must not exceed 50 characters")
    .regex(/^[A-Za-z0-9_]+$/, "Username may contain only letters, numbers and underscores"),
  fullName: z
    .string()
    .trim()
    .min(1, "Full name is required")
    .min(2, "Full name must contain at least 2 characters")
    .max(100, "Full name must not exceed 100 characters"),
  email: OptionalEmailSchema,
  role: z.enum(roleCodes, { error: "Select a valid role" }),
});

const PasswordSchema = z
  .string()
  .min(1, "Password is required")
  .min(8, "Password must contain at least 8 characters")
  .max(100, "Password must not exceed 100 characters");

export const UserCreateSchema = UserBaseSchema.extend({
  password: PasswordSchema,
});

export const UserUpdateSchema = UserBaseSchema.extend({
  id: z.coerce.number().int().positive("Select a user"),
  password: z.union([PasswordSchema, z.literal("")]).optional(),
});

export const UserIdSchema = z.object({
  id: z.coerce.number().int().positive("Select a user"),
});

export const UserPasswordResetSchema = z.object({
  id: z.coerce.number().int().positive("Select a user"),
  password: PasswordSchema,
});
