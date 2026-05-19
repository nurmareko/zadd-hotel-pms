import { z } from "zod";

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Required"),
    newPassword: z.string().min(8, "Minimum 8 characters"),
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Password baru dan konfirmasi tidak cocok",
    path: ["confirmNewPassword"],
  });

export type ChangePasswordInput = z.input<typeof ChangePasswordSchema>;
