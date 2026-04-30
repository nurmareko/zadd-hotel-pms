import { z } from "zod";

export const roleCodes = ["FO", "HK", "FB", "ACC", "ADMIN"] as const;

export type RoleCode = (typeof roleCodes)[number];

const OptionalEmailSchema = z
  .string()
  .trim()
  .max(100, "Email must be 100 characters or fewer")
  .email("Email must be valid")
  .or(z.literal(""))
  .optional()
  .transform((value) => (value ? value : null));

const UserBaseSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Username is required")
    .max(50, "Username must be 50 characters or fewer")
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Username may only contain letters, numbers, underscores, and hyphens",
    ),
  fullName: z
    .string()
    .trim()
    .min(1, "Full name is required")
    .max(100, "Full name must be 100 characters or fewer"),
  email: OptionalEmailSchema,
  role: z.enum(roleCodes),
});

const PasswordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .max(100, "Password must be 100 characters or fewer");

export const UserCreateSchema = UserBaseSchema.extend({
  password: PasswordSchema,
});

export const UserUpdateSchema = UserBaseSchema.extend({
  id: z.coerce.number().int().positive("User is required"),
});

export const UserIdSchema = z.object({
  id: z.coerce.number().int().positive("User is required"),
});

export const UserPasswordResetSchema = z.object({
  id: z.coerce.number().int().positive("User is required"),
  password: PasswordSchema,
});

export type UserCreateInput = z.input<typeof UserCreateSchema>;
export type UserCreateValues = z.output<typeof UserCreateSchema>;
export type UserUpdateInput = z.input<typeof UserUpdateSchema>;
export type UserUpdateValues = z.output<typeof UserUpdateSchema>;
