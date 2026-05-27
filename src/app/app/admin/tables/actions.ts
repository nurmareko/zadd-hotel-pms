"use server";

import { FBOrderStatus, Prisma, TableStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  clampRestaurantTablePosition,
  getRestaurantTableGridPosition,
} from "@/lib/restaurant-table-layout";
import {
  RestaurantTableCreateSchema,
  RestaurantTableIdSchema,
  RestaurantTablePositionSchema,
  RestaurantTableUpdateSchema,
} from "./schema";

type ActionResult = { ok: true } | { ok: false; error: string; field?: string };
type LayoutActionResult =
  | { ok: true; tables: { id: number; posX: number; posY: number }[] }
  | { ok: false; error: string };

const TABLES_PATH = "/app/admin/tables";
const FB_PATH = "/app/fb";

function validationFailure(error: {
  issues: { message: string; path: PropertyKey[] }[];
}): ActionResult {
  const issue = error.issues[0];
  const field = typeof issue?.path[0] === "string" ? issue.path[0] : undefined;

  return {
    ok: false,
    error: issue?.message ?? "Data meja tidak valid",
    field,
  };
}

async function canManageRestaurantTables() {
  const session = await auth();

  return session?.user.role === "ADMIN";
}

function prismaErrorResult(error: unknown): ActionResult {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return { ok: false, error: "Nomor meja sudah digunakan", field: "number" };
    }

    if (error.code === "P2025") {
      return { ok: false, error: "Meja tidak ditemukan" };
    }
  }

  return { ok: false, error: "Terjadi kesalahan" };
}

function revalidateTableScreens() {
  revalidatePath(TABLES_PATH);
  revalidatePath(FB_PATH);
}

export async function createRestaurantTable(
  input: unknown,
): Promise<ActionResult> {
  if (!(await canManageRestaurantTables())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = RestaurantTableCreateSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  try {
    const existingNumber = await prisma.restaurantTable.findUnique({
      where: { number: parsed.data.number },
      select: { id: true },
    });

    if (existingNumber) {
      return {
        ok: false,
        error: "Nomor meja sudah digunakan",
        field: "number",
      };
    }

    const tableCount = await prisma.restaurantTable.count();

    await prisma.restaurantTable.create({
      data: {
        ...parsed.data,
        ...getRestaurantTableGridPosition(tableCount),
      },
    });

    revalidateTableScreens();

    return { ok: true };
  } catch (error) {
    return prismaErrorResult(error);
  }
}

export async function updateRestaurantTable(
  input: unknown,
): Promise<ActionResult> {
  if (!(await canManageRestaurantTables())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = RestaurantTableUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  const { id, ...data } = parsed.data;

  try {
    const existingNumber = await prisma.restaurantTable.findFirst({
      where: { number: data.number, id: { not: id } },
      select: { id: true },
    });

    if (existingNumber) {
      return {
        ok: false,
        error: "Nomor meja sudah digunakan",
        field: "number",
      };
    }

    const openOrderCount = await prisma.fBOrder.count({
      where: { tableId: id, status: FBOrderStatus.OPEN },
    });

    if (openOrderCount > 0 && data.status !== TableStatus.OCCUPIED) {
      return {
        ok: false,
        error: "Meja memiliki order terbuka. Status harus tetap OCCUPIED.",
        field: "status",
      };
    }

    await prisma.restaurantTable.update({
      where: { id },
      data,
    });

    revalidateTableScreens();

    return { ok: true };
  } catch (error) {
    return prismaErrorResult(error);
  }
}

export async function deleteRestaurantTable(
  id: number,
): Promise<ActionResult> {
  if (!(await canManageRestaurantTables())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = RestaurantTableIdSchema.safeParse({ id });

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  try {
    const orderCount = await prisma.fBOrder.count({
      where: { tableId: parsed.data.id },
    });

    if (orderCount > 0) {
      return {
        ok: false,
        error: "Meja memiliki riwayat order. Ubah status ke OUT_OF_SERVICE.",
      };
    }

    await prisma.restaurantTable.delete({
      where: { id: parsed.data.id },
    });

    revalidateTableScreens();

    return { ok: true };
  } catch (error) {
    return prismaErrorResult(error);
  }
}

export async function updateRestaurantTablePosition(
  input: unknown,
): Promise<ActionResult> {
  if (!(await canManageRestaurantTables())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = RestaurantTablePositionSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  const position = clampRestaurantTablePosition(parsed.data);

  try {
    await prisma.restaurantTable.update({
      where: { id: parsed.data.id },
      data: position,
    });

    revalidateTableScreens();

    return { ok: true };
  } catch (error) {
    return prismaErrorResult(error);
  }
}

export async function autoArrangeRestaurantTables(): Promise<LayoutActionResult> {
  if (!(await canManageRestaurantTables())) {
    return { ok: false, error: "Unauthorized" };
  }

  try {
    const updatedTables = await prisma.$transaction(async (tx) => {
      const tables = await tx.restaurantTable.findMany({
        select: { id: true, number: true },
      });
      const sortedTables = tables.toSorted((first, second) =>
        first.number.localeCompare(second.number, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
      const tablePositions = sortedTables.map((table, index) => ({
        id: table.id,
        ...getRestaurantTableGridPosition(index),
      }));

      for (const table of tablePositions) {
        await tx.restaurantTable.update({
          where: { id: table.id },
          data: { posX: table.posX, posY: table.posY },
        });
      }

      return tablePositions;
    });

    revalidateTableScreens();

    return { ok: true, tables: updatedTables };
  } catch {
    return { ok: false, error: "Terjadi kesalahan" };
  }
}
