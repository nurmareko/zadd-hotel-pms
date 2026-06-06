"use server";

import { Prisma, ReservationStatus, RoomStatus } from "@prisma/client";

import { auth } from "@/auth";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { revalidateRoomStatusViews } from "@/lib/revalidate-room-status";

type ActionResult = { ok: true } | { ok: false; error: string };

function isSerializationConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2028")
  );
}

export async function requestRoomCleaning(
  reservationId: number,
): Promise<ActionResult> {
  const session = await auth();

  if (session?.user.role !== "FO" && session?.user.role !== "ADMIN") {
    return { ok: false, error: "Unauthorized" };
  }

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return { ok: false, error: "Reservasi tidak valid" };
  }

  const userId = Number(session.user.id);

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw<Array<{ id: number }>>`
          SELECT id FROM "reservation" WHERE id = ${reservationId} FOR UPDATE
        `;

        const reservation = await tx.reservation.findUnique({
          where: { id: reservationId },
          select: { id: true, roomId: true, status: true },
        });

        if (!reservation) {
          return { ok: false as const, error: "Reservasi tidak ditemukan" };
        }

        if (reservation.status !== ReservationStatus.CHECKED_IN) {
          return {
            ok: false as const,
            error:
              "Pembersihan kamar hanya bisa diminta untuk tamu yang sedang check-in.",
          };
        }

        if (!reservation.roomId) {
          return {
            ok: false as const,
            error: "Reservasi check-in belum memiliki kamar.",
          };
        }

        await tx.$queryRaw<Array<{ id: number }>>`
          SELECT id FROM "room" WHERE id = ${reservation.roomId} FOR UPDATE
        `;

        const room = await tx.room.findUnique({
          where: { id: reservation.roomId },
          select: { id: true, number: true, status: true },
        });

        if (!room) {
          return { ok: false as const, error: "Kamar tidak ditemukan" };
        }

        if (room.status === RoomStatus.OD) {
          return { ok: true as const, roomId: room.id };
        }

        if (room.status !== RoomStatus.OC) {
          return {
            ok: false as const,
            error: `Kamar ${room.number} tidak berstatus OC. Muat ulang halaman dan periksa status kamar.`,
          };
        }

        const now = new Date();

        await tx.housekeepingLog.create({
          data: {
            roomId: room.id,
            oldStatus: RoomStatus.OC,
            newStatus: RoomStatus.OD,
            updatedById: userId,
            updatedAt: now,
            note: "Permintaan pembersihan kamar dari Front Office",
          },
        });

        await tx.room.update({
          where: { id: room.id },
          data: { status: RoomStatus.OD },
        });

        return { ok: true as const, roomId: room.id };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        ...TRANSACTION_OPTIONS,
      },
    );

    if (result.ok) {
      revalidateRoomStatusViews({ reservationId, roomId: result.roomId });
    }

    return result;
  } catch (error) {
    if (isSerializationConflict(error)) {
      return {
        ok: false,
        error: "Status kamar berubah saat diproses. Muat ulang halaman.",
      };
    }

    return { ok: false, error: "Gagal meminta pembersihan kamar" };
  }
}
