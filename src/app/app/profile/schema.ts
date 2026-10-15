import { z } from "zod";

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Required"),
    newPassword: z.string().min(8, "Minimum 8 characters"),
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "The new password and confirmation do not match",
    path: ["confirmNewPassword"],
  });

export type ChangePasswordInput = z.input<typeof ChangePasswordSchema>;
