"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  RoomCreateSchema,
  RoomIdSchema,
  RoomTypeCreateSchema,
  RoomTypeIdSchema,
  RoomTypeUpdateSchema,
  RoomUpdateSchema,
} from "./schema";

type ActionResult = { ok: true } | { ok: false; error: string };

const ROOMS_PATH = "/app/admin/rooms";

function validationError(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid room data";
}

async function canManageRooms() {
  const session = await auth();

  return session?.user.role === "ADMIN";
}

function prismaErrorMessage(error: unknown, entity: "room" | "roomType") {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return entity === "room"
        ? "Room number already exists"
        : "Code already exists";
    }

    if (error.code === "P2003") {
      return entity === "room"
        ? "This room has reservation history. Set to OOO instead."
        : "This room type has rooms. Delete those first.";
    }

    if (error.code === "P2025") {
      return entity === "room" ? "Room not found" : "Room type not found";
    }
  }

  return "Something went wrong";
}

export async function createRoomType(input: unknown): Promise<ActionResult> {
  if (!(await canManageRooms())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = RoomTypeCreateSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  try {
    await prisma.roomType.create({
      data: parsed.data,
    });

    revalidatePath(ROOMS_PATH);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: prismaErrorMessage(error, "roomType") };
  }
}

export async function updateRoomType(input: unknown): Promise<ActionResult> {
  if (!(await canManageRooms())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = RoomTypeUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const { id, ...data } = parsed.data;

  try {
    await prisma.roomType.update({
      where: { id },
      data,
    });

    revalidatePath(ROOMS_PATH);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: prismaErrorMessage(error, "roomType") };
  }
}

export async function deleteRoomType(id: number): Promise<ActionResult> {
  if (!(await canManageRooms())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = RoomTypeIdSchema.safeParse({ id });

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  try {
    const roomCount = await prisma.room.count({
      where: { roomTypeId: parsed.data.id },
    });

    if (roomCount > 0) {
      return {
        ok: false,
        error: "This room type has rooms. Delete those first.",
      };
    }

    await prisma.roomType.delete({
      where: { id: parsed.data.id },
    });

    revalidatePath(ROOMS_PATH);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: prismaErrorMessage(error, "roomType") };
  }
}

export async function createRoom(input: unknown): Promise<ActionResult> {
  if (!(await canManageRooms())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = RoomCreateSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  try {
    await prisma.room.create({
      data: parsed.data,
    });

    revalidatePath(ROOMS_PATH);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: prismaErrorMessage(error, "room") };
  }
}

export async function updateRoom(input: unknown): Promise<ActionResult> {
  if (!(await canManageRooms())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = RoomUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const { id, ...data } = parsed.data;

  try {
    await prisma.room.update({
      where: { id },
      data,
    });

    revalidatePath(ROOMS_PATH);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: prismaErrorMessage(error, "room") };
  }
}

export async function deleteRoom(id: number): Promise<ActionResult> {
  if (!(await canManageRooms())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = RoomIdSchema.safeParse({ id });

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  try {
    const reservationCount = await prisma.reservation.count({
      where: { roomId: parsed.data.id },
    });

    if (reservationCount > 0) {
      return {
        ok: false,
        error: "This room has reservation history. Set to OOO instead.",
      };
    }

    await prisma.room.delete({
      where: { id: parsed.data.id },
    });

    revalidatePath(ROOMS_PATH);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: prismaErrorMessage(error, "room") };
  }
}
