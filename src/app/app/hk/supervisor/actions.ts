"use server";

import { HousekeepingNotificationStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { upsertHousekeepingNotification } from "@/lib/housekeeping-notifications";

type ActionResult = { ok: true; count: number } | { ok: false; error: string };

const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid");

const AssignmentSchema = z.object({
  date: DateStringSchema,
  housekeeperId: z.coerce.number().int().positive("Petugas HK tidak valid"),
  roomIds: z
    .array(z.coerce.number().int().positive("Kamar tidak valid"))
    .min(1, "Pilih minimal satu kamar"),
});

const UnassignmentSchema = z.object({
  date: DateStringSchema,
  roomIds: z
    .array(z.coerce.number().int().positive("Kamar tidak valid"))
    .min(1, "Pilih minimal satu kamar"),
});

function validationError(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Input tidak valid";
}

function assignmentErrorMessage(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021") {
      return "Database belum menerapkan migration notifikasi housekeeping. Jalankan prisma migrate deploy.";
    }

    if (error.code === "P2002") {
      return "Penugasan sedang diproses. Muat ulang halaman dan coba lagi.";
    }
  }

  return error instanceof Error && error.message
    ? `Gagal mengatur penugasan HK: ${error.message}`
    : "Gagal mengatur penugasan HK";
}

function dateOnlyFromISO(value: string) {
  const [yearValue, monthValue, dayValue] = value.split("-");
  const year = Number(yearValue);
  const monthIndex = Number(monthValue) - 1;
  const day = Number(dayValue);
  const date = new Date(Date.UTC(year, monthIndex, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== monthIndex ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function selectedRoomIds(formData: FormData) {
  return formData.getAll("roomId").map((value) => String(value));
}

function revalidateSupervisorAssignmentViews() {
  revalidatePath("/app/hk/supervisor");
  revalidatePath("/app/hk/rooms");
  revalidatePath("/app/hk/clean");
  revalidatePath("/app/hk/rooms/[roomId]", "page");
}

async function authorizeHousekeeping() {
  const session = await auth();

  return session?.user.role === "HK" || session?.user.role === "ADMIN";
}

export async function assignHousekeepingRooms(
  formData: FormData,
): Promise<ActionResult> {
  if (!(await authorizeHousekeeping())) {
    return { ok: false, error: "Tidak berwenang" };
  }

  const parsed = AssignmentSchema.safeParse({
    date: formData.get("date"),
    housekeeperId: formData.get("housekeeperId"),
    roomIds: selectedRoomIds(formData),
  });

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const date = dateOnlyFromISO(parsed.data.date);
  const roomIds = [...new Set(parsed.data.roomIds)];

  if (!date) {
    return { ok: false, error: "Tanggal tidak valid" };
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const [housekeeper, rooms] = await Promise.all([
          tx.user.findFirst({
            where: {
              id: parsed.data.housekeeperId,
              isActive: true,
              roles: { some: { role: { code: "HK" } } },
            },
            select: { id: true },
          }),
          tx.room.findMany({
            where: { id: { in: roomIds } },
            select: { id: true },
          }),
        ]);

        if (!housekeeper) {
          return {
            ok: false as const,
            error: "Petugas HK tidak ditemukan atau tidak aktif",
          };
        }

        if (rooms.length !== roomIds.length) {
          return { ok: false as const, error: "Sebagian kamar tidak ditemukan" };
        }

        for (const roomId of roomIds) {
          const assignment = await tx.housekeepingAssignment.upsert({
            where: { roomId_date: { roomId, date } },
            create: {
              roomId,
              date,
              housekeeperId: housekeeper.id,
            },
            update: { housekeeperId: housekeeper.id },
            select: { id: true },
          });

          await upsertHousekeepingNotification(tx, {
            assignmentId: assignment.id,
            recipientId: housekeeper.id,
            status: HousekeepingNotificationStatus.ASSIGNED,
          });
        }

        return { ok: true as const, count: roomIds.length };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        ...TRANSACTION_OPTIONS,
      },
    );

    if (result.ok) {
      revalidateSupervisorAssignmentViews();
    }

    return result;
  } catch (error) {
    console.error("Housekeeping assignment failed", {
      error,
      date: parsed.data.date,
      housekeeperId: parsed.data.housekeeperId,
      roomIds,
    });
    return { ok: false, error: assignmentErrorMessage(error) };
  }
}

export async function unassignHousekeepingRooms(
  formData: FormData,
): Promise<ActionResult> {
  if (!(await authorizeHousekeeping())) {
    return { ok: false, error: "Tidak berwenang" };
  }

  const parsed = UnassignmentSchema.safeParse({
    date: formData.get("date"),
    roomIds: selectedRoomIds(formData),
  });

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const date = dateOnlyFromISO(parsed.data.date);
  const roomIds = [...new Set(parsed.data.roomIds)];

  if (!date) {
    return { ok: false, error: "Tanggal tidak valid" };
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const rooms = await tx.room.findMany({
          where: { id: { in: roomIds } },
          select: { id: true },
        });

        if (rooms.length !== roomIds.length) {
          return { ok: false as const, error: "Sebagian kamar tidak ditemukan" };
        }

        const deleted = await tx.housekeepingAssignment.deleteMany({
          where: {
            date,
            roomId: { in: roomIds },
          },
        });

        return { ok: true as const, count: deleted.count };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        ...TRANSACTION_OPTIONS,
      },
    );

    if (result.ok) {
      revalidateSupervisorAssignmentViews();
    }

    return result;
  } catch {
    return { ok: false, error: "Gagal menghapus penugasan HK" };
  }
}
