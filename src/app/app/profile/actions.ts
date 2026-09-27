"use server";

import { compare, hash } from "bcryptjs";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ChangePasswordSchema } from "./schema";

type ActionResult = { ok: true } | { ok: false; error: string };

const PASSWORD_COST = 10;

function validationError(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Data kata sandi tidak valid.";
}

export async function changePassword(
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return { ok: false, error: "Anda tidak memiliki izin untuk melakukan tindakan ini." };
  }

  const parsed = ChangePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmNewPassword: formData.get("confirmNewPassword"),
  });

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const userId = Number(session.user.id);

  if (!Number.isInteger(userId)) {
    return { ok: false, error: "Anda tidak memiliki izin untuk melakukan tindakan ini." };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user) {
      return { ok: false, error: "Pengguna tidak ditemukan." };
    }

    const valid = await compare(
      parsed.data.currentPassword,
      user.passwordHash,
    );

    if (!valid) {
      return { ok: false, error: "Kata sandi saat ini tidak benar" };
    }

    const passwordHash = await hash(parsed.data.newPassword, PASSWORD_COST);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
      select: { id: true },
    });

    return { ok: true };
  } catch {
    return { ok: false, error: "Terjadi kesalahan pada sistem." };
  }
}
