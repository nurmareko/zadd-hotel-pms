"use server";

import { Prisma, RoomStatus } from "@prisma/client";

import { auth } from "@/auth";
import { isHkSupervisor } from "@/auth.config";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { revalidateRoomStatusViews } from "@/lib/revalidate-room-status";

import { InspectRoomSchema, type ActionResult } from "./schema";

function validationError(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Input tidak valid";
}

function revalidateRoomPaths(roomId: number) {
  revalidateRoomStatusViews({ roomId });
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

export async function inspectRoom(formData: FormData): Promise<ActionResult> {
  const userId = await requireInspectionUser();

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
