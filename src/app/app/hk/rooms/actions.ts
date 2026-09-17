"use server";

import { HousekeepingNotificationStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { hotelTodayDateOnly, parseISODateOnly } from "@/lib/date-only";
import { upsertHousekeepingNotification } from "@/lib/housekeeping-notifications";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { revalidateRoomStatusViews } from "@/lib/revalidate-room-status";

import { SetRoomHousekeeperSchema, TaskNoteSchema, type ActionResult } from "./task-note-schema";

type RoomMutation = {
  roomId: number;
  assignment?: { dateIso?: string; housekeeperId: number | null };
  taskNote?: { category: string; note: string; operatorId: number };
};

async function authorizedOperator() {
  const session = await auth();
  if (session?.user.role !== "HK" && session?.user.role !== "ADMIN") {
    return null;
  }

  const id = Number(session.user.id);
  return Number.isInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}

function isConflict(error: unknown, codes: string[]) {
  return error instanceof Prisma.PrismaClientKnownRequestError && codes.includes(error.code);
}

// Route-local owner of the complete transition. Both actions share the room lock,
// authoritative reads and retry boundary; no partially callable mutation steps.
async function mutateRoom(input: RoomMutation, failureMessage: string): Promise<ActionResult> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx): Promise<ActionResult> => {
        await tx.$queryRaw<Array<{ id: number }>>`
          SELECT id FROM "room" WHERE id = ${input.roomId} FOR UPDATE
        `;
        const room = await tx.room.findUnique({
          where: { id: input.roomId },
          select: { id: true, status: true },
        });
        if (!room) {
          return { ok: false, error: "Kamar tidak ditemukan" };
        }

        // Anchor assignment and audit time together even if later awaits cross WIB midnight.
        const now = new Date();

        if (input.assignment) {
          const { housekeeperId, dateIso } = input.assignment;
          const date = dateIso ? parseISODateOnly(dateIso) : hotelTodayDateOnly(now);
          if (housekeeperId !== null) {
            const housekeeper = await tx.user.findFirst({
              where: {
                id: housekeeperId,
                isActive: true,
                roles: { some: { role: { code: "HK" } } },
              },
              select: { id: true },
            });
            if (!housekeeper) {
              return { ok: false, error: "Petugas HK tidak ditemukan atau tidak aktif" };
            }
          }

          const assignment = await tx.housekeepingAssignment.findUnique({
            where: { roomId_date: { roomId: input.roomId, date } },
            select: { id: true, housekeeperId: true },
          });
          // Match the assignment's date, not today's date: future scheduling must
          // not disrupt the active cleaner's assignment for another day.
          const activeCleaner = await tx.cleaningSession.findFirst({
            where: {
              roomId: input.roomId,
              date,
              startedAt: { not: null },
              finishedAt: null,
              ...(housekeeperId === null ? {} : { housekeeperId: { not: housekeeperId } }),
            },
            select: { id: true },
          });
          if (activeCleaner) {
            return {
              ok: false,
              error: "Pembersihan kamar sedang berjalan. Selesaikan pembersihan sebelum mengganti atau menghapus petugas HK.",
            };
          }

          if (housekeeperId === null) {
            if (assignment) {
              const deleted = await tx.housekeepingAssignment.deleteMany({
                where: { id: assignment.id, housekeeperId: assignment.housekeeperId },
              });
              if (deleted.count !== 1) {
                throw new Error("Housekeeping assignment changed during deletion");
              }
            }
          } else if (assignment?.housekeeperId !== housekeeperId) {
            const saved = await tx.housekeepingAssignment.upsert({
              where: { roomId_date: { roomId: input.roomId, date } },
              create: { roomId: input.roomId, date, housekeeperId },
              update: { housekeeperId },
              select: { id: true },
            });
            await upsertHousekeepingNotification(tx, {
              assignmentId: saved.id,
              recipientId: housekeeperId,
              status: HousekeepingNotificationStatus.ASSIGNED,
            });
          }
          // An unchanged assignee must not recreate/reset progress notifications.
        }

        if (input.taskNote) {
          const { category, note, operatorId } = input.taskNote;
          await tx.housekeepingLog.create({
            data: {
              roomId: input.roomId,
              oldStatus: room.status,
              newStatus: room.status,
              note: `[TUGAS: ${category}] ${note}`,
              updatedById: operatorId,
              updatedAt: now,
            },
          });
        }
        return { ok: true };
      }, {
        ...TRANSACTION_OPTIONS,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (isConflict(error, ["P2034"]) && attempt < 2) {
        continue;
      }
      if (isConflict(error, ["P2034", "P2028", "P2002"])) {
        return { ok: false, error: "Kamar sedang diproses. Muat ulang halaman dan coba lagi." };
      }
      return { ok: false, error: failureMessage };
    }
  }
  return { ok: false, error: failureMessage };
}

function revalidateRoomPaths(roomId: number) {
  revalidatePath("/app/hk/clean");
  revalidateRoomStatusViews({ roomId });
}

export async function setRoomHousekeeper(
  roomId: number,
  dateIso: string,
  housekeeperId: number | null,
): Promise<ActionResult> {
  if (!(await authorizedOperator())) {
    return { ok: false, error: "Tidak berwenang" };
  }
  const parsed = SetRoomHousekeeperSchema.safeParse({ roomId, dateIso, housekeeperId });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }

  const result = await mutateRoom({
    roomId: parsed.data.roomId,
    assignment: { dateIso: parsed.data.dateIso, housekeeperId: parsed.data.housekeeperId },
  }, "Gagal mengatur petugas HK");
  if (result.ok) revalidateRoomPaths(parsed.data.roomId);
  return result;
}

export async function createHousekeepingTaskNote(formData: FormData): Promise<ActionResult> {
  const operatorId = await authorizedOperator();
  if (!operatorId) {
    return { ok: false, error: "Tidak berwenang" };
  }
  const fields = ["roomId", "category", "note", "housekeeperId"] as const;
  if (!(formData instanceof FormData) || fields.some((field) => formData.getAll(field).length > 1)) {
    return { ok: false, error: "Input tidak valid" };
  }
  // Allowlist persisted fields: priority is informational; reservation notes are FO-owned.
  const parsed = TaskNoteSchema.safeParse({
    roomId: formData.get("roomId"),
    category: formData.get("category"),
    note: formData.get("note"),
    housekeeperId: formData.get("housekeeperId"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }

  const { roomId, housekeeperId, category, note } = parsed.data;
  const result = await mutateRoom({
    roomId,
    assignment: housekeeperId === undefined ? undefined : { housekeeperId },
    taskNote: { category, note, operatorId },
  }, "Gagal menyimpan tugas kamar");
  if (result.ok) revalidateRoomPaths(roomId);
  return result;
}
