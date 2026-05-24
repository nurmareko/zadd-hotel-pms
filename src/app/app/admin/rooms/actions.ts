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

type ActionResult = { ok: true } | { ok: false; error: string; field?: string };

const ROOMS_PATH = "/app/admin/rooms";

function validationFailure(error: {
  issues: { message: string; path: PropertyKey[] }[];
}): ActionResult {
  const issue = error.issues[0];
  const field = typeof issue?.path[0] === "string" ? issue.path[0] : undefined;

  return {
    ok: false,
    error: issue?.message ?? "Data kamar tidak valid",
    field,
  };
}

async function canManageRooms() {
  const session = await auth();

  return session?.user.role === "ADMIN";
}

function prismaErrorResult(
  error: unknown,
  entity: "room" | "roomType",
): ActionResult {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return entity === "room"
        ? {
            ok: false,
            error: "Nomor kamar sudah digunakan",
            field: "number",
          }
        : { ok: false, error: "Kode sudah digunakan", field: "code" };
    }

    if (error.code === "P2003") {
      return {
        ok: false,
        error:
          entity === "room"
            ? "Kamar memiliki riwayat reservasi. Ubah status ke OOO."
            : "Tipe kamar masih memiliki kamar. Hapus kamar terlebih dahulu.",
      };
    }

    if (error.code === "P2025") {
      return {
        ok: false,
        error:
          entity === "room"
            ? "Kamar tidak ditemukan"
            : "Tipe kamar tidak ditemukan",
      };
    }
  }

  return { ok: false, error: "Terjadi kesalahan" };
}

export async function createRoomType(input: unknown): Promise<ActionResult> {
  if (!(await canManageRooms())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = RoomTypeCreateSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  try {
    const existingCode = await prisma.roomType.findUnique({
      where: { code: parsed.data.code },
      select: { id: true },
    });

    if (existingCode) {
      return { ok: false, error: "Kode sudah digunakan", field: "code" };
    }

    await prisma.roomType.create({
      data: parsed.data,
    });

    revalidatePath(ROOMS_PATH);

    return { ok: true };
  } catch (error) {
    return prismaErrorResult(error, "roomType");
  }
}

export async function updateRoomType(input: unknown): Promise<ActionResult> {
  if (!(await canManageRooms())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = RoomTypeUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  const { id, ...data } = parsed.data;

  try {
    const existingCode = await prisma.roomType.findFirst({
      where: { code: data.code, id: { not: id } },
      select: { id: true },
    });

    if (existingCode) {
      return { ok: false, error: "Kode sudah digunakan", field: "code" };
    }

    await prisma.roomType.update({
      where: { id },
      data,
    });

    revalidatePath(ROOMS_PATH);

    return { ok: true };
  } catch (error) {
    return prismaErrorResult(error, "roomType");
  }
}

export async function deleteRoomType(id: number): Promise<ActionResult> {
  if (!(await canManageRooms())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = RoomTypeIdSchema.safeParse({ id });

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  try {
    const roomCount = await prisma.room.count({
      where: { roomTypeId: parsed.data.id },
    });

    if (roomCount > 0) {
      return {
        ok: false,
        error: "Tipe kamar masih memiliki kamar. Hapus kamar terlebih dahulu.",
      };
    }

    await prisma.roomType.delete({
      where: { id: parsed.data.id },
    });

    revalidatePath(ROOMS_PATH);

    return { ok: true };
  } catch (error) {
    return prismaErrorResult(error, "roomType");
  }
}

export async function createRoom(input: unknown): Promise<ActionResult> {
  if (!(await canManageRooms())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = RoomCreateSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  try {
    const existingNumber = await prisma.room.findUnique({
      where: { number: parsed.data.number },
      select: { id: true },
    });

    if (existingNumber) {
      return {
        ok: false,
        error: "Nomor kamar sudah digunakan",
        field: "number",
      };
    }

    await prisma.room.create({
      data: parsed.data,
    });

    revalidatePath(ROOMS_PATH);

    return { ok: true };
  } catch (error) {
    return prismaErrorResult(error, "room");
  }
}

export async function updateRoom(input: unknown): Promise<ActionResult> {
  if (!(await canManageRooms())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = RoomUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  const { id, ...data } = parsed.data;

  try {
    const existingNumber = await prisma.room.findFirst({
      where: { number: data.number, id: { not: id } },
      select: { id: true },
    });

    if (existingNumber) {
      return {
        ok: false,
        error: "Nomor kamar sudah digunakan",
        field: "number",
      };
    }

    await prisma.room.update({
      where: { id },
      data,
    });

    revalidatePath(ROOMS_PATH);

    return { ok: true };
  } catch (error) {
    return prismaErrorResult(error, "room");
  }
}

export async function deleteRoom(id: number): Promise<ActionResult> {
  if (!(await canManageRooms())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = RoomIdSchema.safeParse({ id });

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  try {
    const reservationCount = await prisma.reservation.count({
      where: { roomId: parsed.data.id },
    });

    if (reservationCount > 0) {
      return {
        ok: false,
        error: "Kamar memiliki riwayat reservasi. Ubah status ke OOO.",
      };
    }

    await prisma.room.delete({
      where: { id: parsed.data.id },
    });

    revalidatePath(ROOMS_PATH);

    return { ok: true };
  } catch (error) {
    return prismaErrorResult(error, "room");
  }
}
