"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  MenuItemCreateSchema,
  MenuItemIdSchema,
  MenuItemUpdateSchema,
} from "./schema";

type ActionResult = { ok: true } | { ok: false; error: string };

const MENU_PATH = "/app/fb/menu";

function validationError(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Data menu tidak valid";
}

async function canManageMenuItems() {
  const session = await auth();

  return Boolean(
    session?.user && can(session.user.role, "food_and_beverage:manage_menu"),
  );
}

function prismaErrorMessage(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return "Kode menu sudah digunakan";
    }

    if (error.code === "P2003") {
      return "Menu sedang digunakan";
    }

    if (error.code === "P2025") {
      return "Menu tidak ditemukan";
    }
  }

  return "Terjadi kesalahan saat memproses menu";
}

export async function createMenuItem(input: unknown): Promise<ActionResult> {
  if (!(await canManageMenuItems())) {
    return { ok: false, error: "Anda tidak memiliki izin untuk mengelola menu" };
  }

  const parsed = MenuItemCreateSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  try {
    await prisma.menuItem.create({
      data: parsed.data,
    });

    revalidatePath(MENU_PATH);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: prismaErrorMessage(error) };
  }
}

export async function updateMenuItem(input: unknown): Promise<ActionResult> {
  if (!(await canManageMenuItems())) {
    return { ok: false, error: "Anda tidak memiliki izin untuk mengelola menu" };
  }

  const parsed = MenuItemUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const { id, ...data } = parsed.data;

  try {
    await prisma.menuItem.update({
      where: { id },
      data,
    });

    revalidatePath(MENU_PATH);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: prismaErrorMessage(error) };
  }
}

export async function deleteMenuItem(id: number): Promise<ActionResult> {
  if (!(await canManageMenuItems())) {
    return { ok: false, error: "Anda tidak memiliki izin untuk mengelola menu" };
  }

  const parsed = MenuItemIdSchema.safeParse({ id });

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  try {
    await prisma.menuItem.delete({
      where: { id: parsed.data.id },
    });

    revalidatePath(MENU_PATH);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: prismaErrorMessage(error) };
  }
}

export async function toggleMenuItemActive(id: number): Promise<ActionResult> {
  if (!(await canManageMenuItems())) {
    return { ok: false, error: "Anda tidak memiliki izin untuk mengelola menu" };
  }

  const parsed = MenuItemIdSchema.safeParse({ id });

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  try {
    const menuItem = await prisma.menuItem.findUniqueOrThrow({
      where: { id: parsed.data.id },
      select: { isActive: true },
    });

    await prisma.menuItem.update({
      where: { id: parsed.data.id },
      data: { isActive: !menuItem.isActive },
    });

    revalidatePath(MENU_PATH);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: prismaErrorMessage(error) };
  }
}
