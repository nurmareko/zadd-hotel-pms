"use server";

import { FBOrderStatus, Prisma, TableStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  RestaurantTableCreateSchema,
  RestaurantTableIdSchema,
  RestaurantTableUpdateSchema,
} from "./schema";

type ActionResult = { ok: true } | { ok: false; error: string };

const TABLES_PATH = "/app/admin/tables";
const FB_PATH = "/app/fb";

function validationError(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid table data";
}

async function canManageRestaurantTables() {
  const session = await auth();

  return session?.user.role === "ADMIN";
}

function prismaErrorMessage(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return "Table number already exists";
    }

    if (error.code === "P2025") {
      return "Table not found";
    }
  }

  return "Something went wrong";
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
    return { ok: false, error: validationError(parsed.error) };
  }

  try {
    await prisma.restaurantTable.create({
      data: parsed.data,
    });

    revalidateTableScreens();

    return { ok: true };
  } catch (error) {
    return { ok: false, error: prismaErrorMessage(error) };
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
    return { ok: false, error: validationError(parsed.error) };
  }

  const { id, ...data } = parsed.data;

  try {
    const openOrderCount = await prisma.fBOrder.count({
      where: { tableId: id, status: FBOrderStatus.OPEN },
    });

    if (openOrderCount > 0 && data.status !== TableStatus.OCCUPIED) {
      return {
        ok: false,
        error: "Table has an open order. Keep status as OCCUPIED first.",
      };
    }

    await prisma.restaurantTable.update({
      where: { id },
      data,
    });

    revalidateTableScreens();

    return { ok: true };
  } catch (error) {
    return { ok: false, error: prismaErrorMessage(error) };
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
    return { ok: false, error: validationError(parsed.error) };
  }

  try {
    const orderCount = await prisma.fBOrder.count({
      where: { tableId: parsed.data.id },
    });

    if (orderCount > 0) {
      return {
        ok: false,
        error: "This table has order history. Set it OUT_OF_SERVICE instead.",
      };
    }

    await prisma.restaurantTable.delete({
      where: { id: parsed.data.id },
    });

    revalidateTableScreens();

    return { ok: true };
  } catch (error) {
    return { ok: false, error: prismaErrorMessage(error) };
  }
}
