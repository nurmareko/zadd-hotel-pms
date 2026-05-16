"use server";

import { Prisma, RoomStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import {
  InspectRoomSchema,
  RoomActionSchema,
  StopCleaningSchema,
  type ActionResult,
} from "./schema";

const HK_ROOM_PATH_PREFIX = "/app/hk/rooms";
const SYNC_PATHS = ["/app/hk", "/app/fo/tape-chart", "/app/fo"] as const;

function validationError(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Input tidak valid";
}

function revalidateRoomPaths(roomId: number) {
  revalidatePath(`${HK_ROOM_PATH_PREFIX}/${roomId}`);

  for (const path of SYNC_PATHS) {
    revalidatePath(path);
  }
}

async function requireHKUser() {
  const session = await auth();

  if (session?.user.role !== "HK") {
    return null;
  }

  return Number(session.user.id);
}

function isSerializationConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2028")
  );
}

export async function startCleaning(formData: FormData): Promise<ActionResult> {
  const userId = await requireHKUser();

  if (!userId) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = RoomActionSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const { roomId } = parsed.data;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw<Array<{ id: number }>>`
          SELECT id FROM "room" WHERE id = ${roomId} FOR UPDATE
        `;

        const room = await tx.room.findUnique({
          where: { id: roomId },
          select: { id: true, status: true },
        });

        if (!room) {
          return { ok: false as const, error: "Kamar tidak ditemukan" };
        }

        if (room.status !== RoomStatus.VD && room.status !== RoomStatus.OD) {
          return {
            ok: false as const,
            error: "Kamar ini tidak berada dalam antrean pembersihan",
          };
        }

        const activeLog = await tx.housekeepingLog.findFirst({
          where: {
            roomId,
            cleaningStartedAt: { not: null },
            cleaningCompletedAt: null,
          },
          select: { id: true },
        });

        if (activeLog) {
          return {
            ok: false as const,
            error: "Pembersihan kamar ini sudah berjalan",
          };
        }

        const now = new Date();

        await tx.housekeepingLog.create({
          data: {
            roomId,
            oldStatus: room.status,
            newStatus: room.status,
            updatedById: userId,
            updatedAt: now,
            cleaningStartedAt: now,
            cleaningCompletedAt: null,
            note: null,
          },
        });

        return { ok: true as const };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (result.ok) {
      revalidateRoomPaths(roomId);
    }

    return result;
  } catch (error) {
    if (isSerializationConflict(error)) {
      return { ok: false, error: "Kamar sedang diproses. Muat ulang halaman." };
    }

    return { ok: false, error: "Gagal memulai pembersihan" };
  }
}

export async function stopCleaning(formData: FormData): Promise<ActionResult> {
  const userId = await requireHKUser();

  if (!userId) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = StopCleaningSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const { roomId, notes } = parsed.data;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw<Array<{ id: number }>>`
          SELECT id FROM "room" WHERE id = ${roomId} FOR UPDATE
        `;

        const room = await tx.room.findUnique({
          where: { id: roomId },
          select: { id: true, status: true },
        });

        if (!room) {
          return { ok: false as const, error: "Kamar tidak ditemukan" };
        }

        if (room.status !== RoomStatus.VD && room.status !== RoomStatus.OD) {
          return {
            ok: false as const,
            error: "Status kamar berubah. Muat ulang halaman.",
          };
        }

        const activeLog = await tx.housekeepingLog.findFirst({
          where: {
            roomId,
            cleaningStartedAt: { not: null },
            cleaningCompletedAt: null,
          },
          orderBy: { updatedAt: "desc" },
          select: { id: true },
        });

        if (!activeLog) {
          return {
            ok: false as const,
            error: "Tidak ada sesi pembersihan aktif",
          };
        }

        const now = new Date();

        await tx.housekeepingLog.update({
          where: { id: activeLog.id },
          data: {
            newStatus: RoomStatus.VCU,
            cleaningCompletedAt: now,
            updatedById: userId,
            updatedAt: now,
            note: notes,
          },
        });

        await tx.room.update({
          where: { id: roomId },
          data: { status: RoomStatus.VCU },
        });

        return { ok: true as const };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (result.ok) {
      revalidateRoomPaths(roomId);
    }

    return result;
  } catch (error) {
    if (isSerializationConflict(error)) {
      return { ok: false, error: "Kamar sedang diproses. Muat ulang halaman." };
    }

    return { ok: false, error: "Gagal menghentikan pembersihan" };
  }
}

export async function inspectRoom(formData: FormData): Promise<ActionResult> {
  const userId = await requireHKUser();

  if (!userId) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = InspectRoomSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const { roomId, passed, notes } = parsed.data;
  const nextStatus = passed ? RoomStatus.VC : RoomStatus.VD;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw<Array<{ id: number }>>`
          SELECT id FROM "room" WHERE id = ${roomId} FOR UPDATE
        `;

        const room = await tx.room.findUnique({
          where: { id: roomId },
          select: { id: true, status: true },
        });

        if (!room) {
          return { ok: false as const, error: "Kamar tidak ditemukan" };
        }

        if (room.status !== RoomStatus.VCU) {
          return {
            ok: false as const,
            error: "Kamar ini tidak menunggu inspeksi",
          };
        }

        const now = new Date();

        await tx.housekeepingLog.create({
          data: {
            roomId,
            oldStatus: RoomStatus.VCU,
            newStatus: nextStatus,
            updatedById: userId,
            updatedAt: now,
            cleaningStartedAt: null,
            cleaningCompletedAt: null,
            note: notes,
          },
        });

        await tx.room.update({
          where: { id: roomId },
          data: { status: nextStatus },
        });

        return { ok: true as const };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (result.ok) {
      revalidateRoomPaths(roomId);
    }

    return result;
  } catch (error) {
    if (isSerializationConflict(error)) {
      return { ok: false, error: "Kamar sedang diproses. Muat ulang halaman." };
    }

    return { ok: false, error: "Gagal menyimpan hasil inspeksi" };
  }
}
