"use server";

import { Prisma, ReservationStatus, RoomStatus } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { revalidateRoomStatusViews } from "@/lib/revalidate-room-status";

import { allowedRoomStatuses } from "./room-status-options";

type ActionResult = { ok: true } | { ok: false; error: string };

const UpdateRoomStatusSchema = z.object({
  roomId: z.coerce.number().int().positive("Kamar tidak valid"),
  status: z.enum(RoomStatus),
});

const RoomStatusOverrideSchema = z.object({
  roomId: z.coerce.number().int().positive("Kamar tidak valid"),
  status: z.enum(RoomStatus),
});

function validationError(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Input tidak valid";
}

function isSerializationConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2028")
  );
}

export async function updateRoomStatus(
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();

  if (session?.user.role !== "HK" && session?.user.role !== "ADMIN") {
    return { ok: false, error: "Tidak berwenang" };
  }

  const parsed = UpdateRoomStatusSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const userId = Number(session.user.id);
  const { roomId, status } = parsed.data;

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

        if (room.status === status) {
          return { ok: true as const };
        }

        const [inHouseReservation, activeCleaningSession] = await Promise.all([
          tx.reservation.findFirst({
            where: {
              roomId,
              status: ReservationStatus.CHECKED_IN,
            },
            select: { id: true },
          }),
          tx.cleaningSession.findFirst({
            where: {
              roomId,
              startedAt: { not: null },
              finishedAt: null,
            },
            select: { id: true },
          }),
        ]);
        const isOccupied = Boolean(inHouseReservation);

        if (!allowedRoomStatuses(isOccupied).includes(status)) {
          return {
            ok: false as const,
            error: isOccupied
              ? "Kamar dengan tamu check-in hanya bisa memakai status OC, OD, atau OOO."
              : "Kamar tanpa tamu check-in hanya bisa memakai status VC, VD, VCU, atau OOO.",
          };
        }

        if (activeCleaningSession) {
          return {
            ok: false as const,
            error:
              "Pembersihan kamar sedang berjalan. Selesaikan dari daftar kerja petugas HK terlebih dahulu.",
          };
        }

        const now = new Date();

        await tx.housekeepingLog.create({
          data: {
            roomId,
            oldStatus: room.status,
            newStatus: status,
            updatedById: userId,
            updatedAt: now,
            note: "Perubahan status manual dari papan kamar HK",
          },
        });

        await tx.room.update({
          where: { id: roomId },
          data: { status },
        });

        return { ok: true as const };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        ...TRANSACTION_OPTIONS,
      },
    );

    if (result.ok) {
      revalidateRoomStatusViews({ roomId });
    }

    return result;
  } catch (error) {
    if (isSerializationConflict(error)) {
      return { ok: false, error: "Kamar sedang diproses. Muat ulang halaman." };
    }

    return { ok: false, error: "Gagal memperbarui status kamar" };
  }
}

export async function setRoomStatusOverride(
  roomId: number,
  status: RoomStatus,
): Promise<ActionResult> {
  const session = await auth();

  if (session?.user.role !== "HK" && session?.user.role !== "ADMIN") {
    return { ok: false, error: "Tidak berwenang" };
  }

  const parsed = RoomStatusOverrideSchema.safeParse({ roomId, status });

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw<Array<{ id: number }>>`
          SELECT id FROM "room" WHERE id = ${parsed.data.roomId} FOR UPDATE
        `;

        const room = await tx.room.findUnique({
          where: { id: parsed.data.roomId },
          select: { id: true, status: true },
        });

        if (!room) {
          return { ok: false as const, error: "Kamar tidak ditemukan" };
        }

        if (room.status === parsed.data.status) {
          return { ok: true as const };
        }

        const activeCleaningSession = await tx.cleaningSession.findFirst({
          where: {
            roomId: room.id,
            startedAt: { not: null },
            finishedAt: null,
          },
          select: { id: true },
        });

        if (activeCleaningSession) {
          return {
            ok: false as const,
            error:
              "Pembersihan kamar sedang berjalan. Selesaikan dari daftar kerja petugas HK terlebih dahulu.",
          };
        }

        const now = new Date();

        await tx.housekeepingLog.create({
          data: {
            roomId: room.id,
            oldStatus: room.status,
            newStatus: parsed.data.status,
            updatedById: Number(session.user.id),
            updatedAt: now,
            note: "Perubahan status manual oleh petugas HK atau ADMIN",
          },
        });

        await tx.room.update({
          where: { id: room.id },
          data: { status: parsed.data.status },
        });

        return { ok: true as const };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        ...TRANSACTION_OPTIONS,
      },
    );

    if (result.ok) {
      revalidateRoomStatusViews({ roomId: parsed.data.roomId });
    }

    return result;
  } catch (error) {
    if (isSerializationConflict(error)) {
      return { ok: false, error: "Kamar sedang diproses. Muat ulang halaman." };
    }

    return { ok: false, error: "Gagal menyimpan perubahan status kamar" };
  }
}
