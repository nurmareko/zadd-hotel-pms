"use server";

import { Prisma, RoomStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { todayDateOnly } from "@/lib/date-only";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { revalidateRoomStatusViews } from "@/lib/revalidate-room-status";

import {
  LogFoundItemSchema,
  RoomActionSchema,
  ToggleAddOnSchema,
  type ActionResult,
} from "./schema";

function validationError(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Input tidak valid";
}

// The cleaning worklist is the housekeeper's own; only an HK account (member or
// supervisor) acts on it, and every action is further scoped to rooms assigned
// to *this* user today.
async function requireHousekeeper() {
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

function revalidateCleaningViews(roomId: number) {
  revalidatePath("/app/hk/clean");
  revalidatePath("/app/hk/list");
  revalidatePath("/app/hk/supervisor");
  revalidateRoomStatusViews({ roomId });
}

export async function startCleaning(formData: FormData): Promise<ActionResult> {
  const userId = await requireHousekeeper();

  if (!userId) {
    return { ok: false, error: "Unauthorized" };
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
          where: { roomId, date: today, startedAt: { not: null }, finishedAt: null },
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
      revalidateCleaningViews(roomId);
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
  const userId = await requireHousekeeper();

  if (!userId) {
    return { ok: false, error: "Unauthorized" };
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

        // VD turnover → awaiting inspection (VCU); OD stayover → occupied clean.
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
            note: "Pembersihan selesai dari daftar kerja housekeeper",
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
      revalidateCleaningViews(roomId);
    }

    return result;
  } catch (error) {
    if (isSerializationConflict(error)) {
      return { ok: false, error: "Kamar sedang diproses. Muat ulang halaman." };
    }

    return { ok: false, error: "Gagal menyelesaikan pembersihan" };
  }
}

export async function toggleAddOnDelivered(
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireHousekeeper();

  if (!userId) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = ToggleAddOnSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const { addOnId, delivered } = parsed.data;
  const { today } = todayDateOnly();

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const addOn = await tx.reservationAddOn.findUnique({
          where: { id: addOnId },
          select: { id: true, reservation: { select: { roomId: true } } },
        });

        if (!addOn) {
          return { ok: false as const, error: "Add-on tidak ditemukan" };
        }

        const roomId = addOn.reservation.roomId;

        if (!roomId) {
          return { ok: false as const, error: "Kamar reservasi belum ditentukan" };
        }

        const assignment = await tx.housekeepingAssignment.findFirst({
          where: { roomId, date: today, housekeeperId: userId },
          select: { id: true },
        });

        if (!assignment) {
          return { ok: false as const, error: "Kamar ini bukan tugas Anda" };
        }

        await tx.reservationAddOn.update({
          where: { id: addOnId },
          data: { delivered },
        });

        return { ok: true as const, roomId };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        ...TRANSACTION_OPTIONS,
      },
    );

    if (result.ok) {
      revalidateCleaningViews(result.roomId);
    }

    return result.ok ? { ok: true } : result;
  } catch (error) {
    if (isSerializationConflict(error)) {
      return { ok: false, error: "Add-on sedang diproses. Muat ulang halaman." };
    }

    return { ok: false, error: "Gagal memperbarui add-on" };
  }
}

export async function logFoundItem(formData: FormData): Promise<ActionResult> {
  const userId = await requireHousekeeper();

  if (!userId) {
    return { ok: false, error: "Unauthorized" };
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
      revalidatePath("/app/hk/clean");
      revalidatePath("/app/hk/lost-found");
    }

    return result;
  } catch (error) {
    if (isSerializationConflict(error)) {
      return { ok: false, error: "Kamar sedang diproses. Muat ulang halaman." };
    }

    return { ok: false, error: "Gagal mencatat barang temuan" };
  }
}

export async function logFoundItemFromCleanCard(
  formData: FormData,
): Promise<void> {
  await logFoundItem(formData);
}
