"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { isHkSupervisor } from "@/auth.config";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";

type ActionResult = { ok: true; count: number } | { ok: false; error: string };

const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid");

const AssignmentSchema = z.object({
  date: DateStringSchema,
  housekeeperId: z.coerce.number().int().positive("Housekeeper tidak valid"),
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
}

async function authorizeSupervisor() {
  const session = await auth();

  return Boolean(
    session?.user &&
      (session.user.role === "ADMIN" || isHkSupervisor(session)),
  );
}

export async function assignHousekeepingRooms(
  formData: FormData,
): Promise<ActionResult> {
  if (!(await authorizeSupervisor())) {
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
              isSupervisor: false,
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
            error: "Housekeeper tidak ditemukan atau tidak aktif",
          };
        }

        if (rooms.length !== roomIds.length) {
          return { ok: false as const, error: "Sebagian kamar tidak ditemukan" };
        }

        await Promise.all(
          roomIds.map((roomId) =>
            tx.housekeepingAssignment.upsert({
              where: {
                roomId_date: {
                  roomId,
                  date,
                },
              },
              create: {
                roomId,
                date,
                housekeeperId: housekeeper.id,
              },
              update: {
                housekeeperId: housekeeper.id,
              },
              select: { id: true },
            }),
          ),
        );

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
  } catch {
    return { ok: false, error: "Gagal mengatur penugasan HK" };
  }
}

export async function unassignHousekeepingRooms(
  formData: FormData,
): Promise<ActionResult> {
  if (!(await authorizeSupervisor())) {
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
