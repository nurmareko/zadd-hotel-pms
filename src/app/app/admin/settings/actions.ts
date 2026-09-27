"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { HotelSettingsUpdateSchema } from "./schema";

type ActionResult = { ok: true } | { ok: false; error: string };

const SETTINGS_PATH = "/app/admin/settings";
const SETTINGS_ID = 1;

function validationError(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Data pengaturan hotel tidak valid.";
}

async function canManageSettings() {
  const session = await auth();

  return session?.user.role === "ADMIN";
}

function prismaErrorMessage(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return "Pengaturan hotel tidak ditemukan.";
    }
  }

  return "Terjadi kesalahan pada sistem.";
}

export async function updateHotelSettings(
  input: unknown,
): Promise<ActionResult> {
  if (!(await canManageSettings())) {
    return { ok: false, error: "Anda tidak memiliki izin untuk melakukan tindakan ini." };
  }

  const parsed = HotelSettingsUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  try {
    await prisma.hotelSettings.update({
      where: { id: SETTINGS_ID },
      data: parsed.data,
    });

    revalidatePath(SETTINGS_PATH);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: prismaErrorMessage(error) };
  }
}
