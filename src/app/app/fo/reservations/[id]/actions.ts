"use server";

import { Prisma, ReservationStatus, RoomStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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

// FO and ADMIN may curate the housekeeping reminders on a reservation. HK only
// toggles the delivered flag during cleaning (see hk/clean/actions.ts).
async function requireFrontOffice() {
  const session = await auth();

  if (session?.user.role !== "FO" && session?.user.role !== "ADMIN") {
    return null;
  }

  return Number(session.user.id);
}

// The note + add-ons flow to the HK worksheet and the cleaning cards, so any
// edit must refresh those surfaces alongside the reservation detail itself.
function revalidateHousekeepingReminderViews(reservationId: number) {
  revalidatePath(`/app/fo/reservations/${reservationId}`);
  revalidatePath("/app/hk/list");
  revalidatePath("/app/hk/clean");
}

const HousekeepingNoteSchema = z.object({
  reservationId: z.coerce.number().int().positive(),
  note: z.string().trim().max(1000, "Catatan maksimal 1000 karakter"),
});

const AddOnLabelSchema = z.object({
  reservationId: z.coerce.number().int().positive(),
  label: z
    .string()
    .trim()
    .min(1, "Label tidak boleh kosong")
    .max(100, "Label maksimal 100 karakter"),
});

export async function updateHousekeepingNote(
  reservationId: number,
  note: string,
): Promise<ActionResult> {
  if ((await requireFrontOffice()) === null) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = HousekeepingNoteSchema.safeParse({ reservationId, note });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Input tidak valid",
    };
  }

  const trimmed = parsed.data.note;

  try {
    await prisma.reservation.update({
      where: { id: parsed.data.reservationId },
      data: { housekeepingNote: trimmed.length > 0 ? trimmed : null },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { ok: false, error: "Reservasi tidak ditemukan" };
    }

    return { ok: false, error: "Gagal menyimpan catatan housekeeping" };
  }

  revalidateHousekeepingReminderViews(parsed.data.reservationId);

  return { ok: true };
}

export async function addReservationAddOn(
  reservationId: number,
  label: string,
): Promise<ActionResult> {
  if ((await requireFrontOffice()) === null) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = AddOnLabelSchema.safeParse({ reservationId, label });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Input tidak valid",
    };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: parsed.data.reservationId },
        select: { id: true },
      });

      if (!reservation) {
        return { ok: false as const, error: "Reservasi tidak ditemukan" };
      }

      await tx.reservationAddOn.create({
        data: {
          reservationId: parsed.data.reservationId,
          label: parsed.data.label,
        },
      });

      return { ok: true as const };
    }, TRANSACTION_OPTIONS);

    if (result.ok) {
      revalidateHousekeepingReminderViews(parsed.data.reservationId);
    }

    return result;
  } catch {
    return { ok: false, error: "Gagal menambahkan add-on" };
  }
}

export async function removeReservationAddOn(
  addOnId: number,
): Promise<ActionResult> {
  if ((await requireFrontOffice()) === null) {
    return { ok: false, error: "Unauthorized" };
  }

  if (!Number.isInteger(addOnId) || addOnId <= 0) {
    return { ok: false, error: "Add-on tidak valid" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const addOn = await tx.reservationAddOn.findUnique({
        where: { id: addOnId },
        select: { id: true, reservationId: true },
      });

      if (!addOn) {
        return { ok: false as const, error: "Add-on tidak ditemukan" };
      }

      await tx.reservationAddOn.delete({ where: { id: addOnId } });

      return { ok: true as const, reservationId: addOn.reservationId };
    }, TRANSACTION_OPTIONS);

    if (result.ok) {
      revalidateHousekeepingReminderViews(result.reservationId);
    }

    return result.ok ? { ok: true } : result;
  } catch {
    return { ok: false, error: "Gagal menghapus add-on" };
  }
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
