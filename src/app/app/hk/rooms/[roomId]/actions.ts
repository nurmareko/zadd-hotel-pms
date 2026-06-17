"use server";

import { Prisma, RoomStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { isHkSupervisor } from "@/auth.config";
import { todayDateOnly } from "@/lib/date-only";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { revalidateRoomStatusViews } from "@/lib/revalidate-room-status";

import {
  FinishCleaningSchema,
  InspectRoomSchema,
  LogFoundItemSchema,
  RoomActionSchema,
  type ActionResult,
} from "./schema";

function validationError(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Input tidak valid";
}

function revalidateRoomPaths(roomId: number) {
  revalidatePath("/app/hk/clean");
  revalidatePath("/app/hk/rooms");
  revalidatePath("/app/hk/supervisor");
  revalidateRoomStatusViews({ roomId });
}

// The housekeeper work actions are scoped to this user's own assignment today.
// Keep this separate from supervisor inspection so a supervisor cannot finish
// a room from the housekeeper workflow.
async function requireHousekeeperMember() {
  const session = await auth();

  if (session?.user.role !== "HK" || isHkSupervisor(session)) {
    return null;
  }

  return Number(session.user.id);
}

async function requireInspectionUser() {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && !isHkSupervisor(session))
  ) {
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
  const userId = await requireHousekeeperMember();

  if (!userId) {
    return { ok: false, error: "Tidak berwenang" };
  }

  const parsed = RoomActionSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const { roomId } = parsed.data;
  const { today } = todayDateOnly();

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw<Array<{ id: number }>>`
          SELECT id FROM "room" WHERE id = ${roomId} FOR UPDATE
        `;

        const assignment = await tx.housekeepingAssignment.findFirst({
          where: { roomId, date: today, housekeeperId: userId },
          select: { id: true },
        });

        if (!assignment) {
          return { ok: false as const, error: "Kamar ini bukan tugas Anda" };
        }

        const room = await tx.room.findUnique({
          where: { id: roomId },
          select: { status: true },
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

        const openSession = await tx.cleaningSession.findFirst({
          where: {
            roomId,
            date: today,
            startedAt: { not: null },
            finishedAt: null,
          },
          select: { id: true },
        });

        if (openSession) {
          return {
            ok: false as const,
            error: "Pembersihan kamar ini sudah berjalan",
          };
        }

        await tx.cleaningSession.create({
          data: {
            roomId,
            housekeeperId: userId,
            date: today,
            startedAt: new Date(),
          },
        });

        return { ok: true as const };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        ...TRANSACTION_OPTIONS,
      },
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

export async function finishCleaning(formData: FormData): Promise<ActionResult> {
  const userId = await requireHousekeeperMember();

  if (!userId) {
    return { ok: false, error: "Tidak berwenang" };
  }

  const parsed = FinishCleaningSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const { roomId, linenChanged, towelChanged, note } = parsed.data;
  const { today } = todayDateOnly();

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw<Array<{ id: number }>>`
          SELECT id FROM "room" WHERE id = ${roomId} FOR UPDATE
        `;

        const assignment = await tx.housekeepingAssignment.findFirst({
          where: { roomId, date: today, housekeeperId: userId },
          select: { id: true },
        });

        if (!assignment) {
          return { ok: false as const, error: "Kamar ini bukan tugas Anda" };
        }

        const room = await tx.room.findUnique({
          where: { id: roomId },
          select: { status: true },
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

        const openSession = await tx.cleaningSession.findFirst({
          where: {
            roomId,
            date: today,
            housekeeperId: userId,
            startedAt: { not: null },
            finishedAt: null,
          },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });

        if (!openSession) {
          return { ok: false as const, error: "Tidak ada sesi pembersihan aktif" };
        }

        // VD turnover -> awaiting inspection (VCU); OD stayover -> occupied clean.
        const nextStatus =
          room.status === RoomStatus.OD ? RoomStatus.OC : RoomStatus.VCU;
        const now = new Date();

        await tx.cleaningSession.update({
          where: { id: openSession.id },
          data: { finishedAt: now },
        });

        await tx.housekeepingLog.create({
          data: {
            roomId,
            oldStatus: room.status,
            newStatus: nextStatus,
            updatedById: userId,
            updatedAt: now,
            note: note || "Pembersihan selesai dari daftar kerja housekeeper",
            linenChanged,
            towelChanged,
          },
        });

        await tx.room.update({
          where: { id: roomId },
          data: { status: nextStatus },
        });

        return { ok: true as const };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        ...TRANSACTION_OPTIONS,
      },
    );

    if (result.ok) {
      revalidateRoomPaths(roomId);
    }

    return result;
  } catch (error) {
    if (isSerializationConflict(error)) {
      return { ok: false, error: "Kamar sedang diproses. Muat ulang halaman." };
    }

    return { ok: false, error: "Gagal menyelesaikan pembersihan" };
  }
}

export async function logFoundItem(formData: FormData): Promise<ActionResult> {
  const userId = await requireHousekeeperMember();

  if (!userId) {
    return { ok: false, error: "Tidak berwenang" };
  }

  const parsed = LogFoundItemSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const { roomId, description } = parsed.data;
  const { today } = todayDateOnly();

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw<Array<{ id: number }>>`
          SELECT id FROM "room" WHERE id = ${roomId} FOR UPDATE
        `;

        const assignment = await tx.housekeepingAssignment.findFirst({
          where: { roomId, date: today, housekeeperId: userId },
          select: { id: true },
        });

        if (!assignment) {
          return { ok: false as const, error: "Kamar ini bukan tugas Anda" };
        }

        const room = await tx.room.findUnique({
          where: { id: roomId },
          select: { id: true },
        });

        if (!room) {
          return { ok: false as const, error: "Kamar tidak ditemukan" };
        }

        await tx.lostFoundItem.create({
          data: {
            roomId,
            description,
            foundById: userId,
          },
        });

        return { ok: true as const };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        ...TRANSACTION_OPTIONS,
      },
    );

    if (result.ok) {
      revalidatePath("/app/hk/lost-found");
      revalidateRoomPaths(roomId);
    }

    return result;
  } catch (error) {
    if (isSerializationConflict(error)) {
      return { ok: false, error: "Kamar sedang diproses. Muat ulang halaman." };
    }

    return { ok: false, error: "Gagal mencatat barang temuan" };
  }
}

export async function inspectRoom(formData: FormData): Promise<ActionResult> {
  const userId = await requireInspectionUser();

  if (!userId) {
    return { ok: false, error: "Tidak berwenang" };
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
        const session = await tx.cleaningSession.findFirst({
          where: {
            roomId,
            finishedAt: { not: null },
            inspectedAt: null,
          },
          orderBy: [{ finishedAt: "desc" }, { createdAt: "desc" }],
          select: { id: true },
        });

        if (session) {
          await tx.cleaningSession.update({
            where: { id: session.id },
            data: {
              inspectedAt: now,
              inspectedById: userId,
            },
          });
        }

        await tx.housekeepingLog.create({
          data: {
            roomId,
            oldStatus: room.status,
            newStatus: nextStatus,
            updatedById: userId,
            updatedAt: now,
            note: notes,
          },
        });

        await tx.room.update({
          where: { id: roomId },
          data: { status: nextStatus },
        });

        return { ok: true as const };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        ...TRANSACTION_OPTIONS,
      },
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
