"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { todayDateOnly } from "@/lib/date-only";
import {
  finishCleaningOperation,
  inspectRoomOperation,
  startCleaningOperation,
  type CleaningOperator,
} from "@/lib/housekeeping/cleaning-operations";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { allocateLostFoundReference, isLostFoundReferenceConflict } from "@/lib/lost-found/reference-allocation";
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

// Work actions require today's assignment inside the canonical transaction;
// inspection remains available to HK and ADMIN regardless of assignment.
async function requireHousekeeperMember(): Promise<CleaningOperator | null> {
  const session = await auth();
  if (session?.user.role !== "HK" && session?.user.role !== "ADMIN") return null;
  const userId = Number(session.user.id);
  if (!Number.isSafeInteger(userId) || userId <= 0 || userId > 2147483647) return null;
  return { userId, role: session.user.role };
}

function isSerializationConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2028")
  );
}

export async function startCleaning(formData: FormData): Promise<ActionResult> {
  const operator = await requireHousekeeperMember();
  if (!operator) return { ok: false, error: "Tidak berwenang" };
  const parsed = RoomActionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: validationError(parsed.error) };
  const result = await startCleaningOperation({ ...operator, ...parsed.data });
  if (result.ok) revalidateRoomPaths(parsed.data.roomId);
  return result;
}

export async function finishCleaning(formData: FormData): Promise<ActionResult> {
  const operator = await requireHousekeeperMember();
  if (!operator) return { ok: false, error: "Tidak berwenang" };
  const parsed = FinishCleaningSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: validationError(parsed.error) };
  const result = await finishCleaningOperation({ ...operator, ...parsed.data });
  if (result.ok) revalidateRoomPaths(parsed.data.roomId);
  return result;
}

export async function logFoundItem(formData: FormData): Promise<ActionResult> {
  const operator = await requireHousekeeperMember();
  if (!operator) {
    return { ok: false, error: "Tidak berwenang" };
  }
  const { userId } = operator;
  const parsed = LogFoundItemSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const { roomId, description } = parsed.data;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw<Array<{ id: number }>>`
            SELECT id FROM "room" WHERE id = ${roomId} FOR UPDATE
          `;

          const { today } = todayDateOnly();
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

          const currentOperator = await tx.user.findFirst({
            where: { id: userId, isActive: true, roles: { some: { role: { code: operator.role } } } },
            select: { id: true },
          });
          if (!currentOperator) return { ok: false as const, error: "Tidak berwenang" };

          const allocation = await allocateLostFoundReference(tx);
          await tx.lostFoundItem.create({
            data: {
              ...allocation,
              roomId,
              description,
              foundById: userId,
              category: "OTHER",
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
        revalidatePath("/app/hk/mobile");
        revalidateRoomPaths(roomId);
      }

      return result;
    } catch (error) {
      const retryable = isLostFoundReferenceConflict(error) ||
        (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034");
      if (retryable && attempt < 2) continue;
      if (retryable || isSerializationConflict(error)) {
        return { ok: false, error: "Kamar sedang diproses. Muat ulang halaman." };
      }
      return { ok: false, error: "Gagal mencatat barang temuan" };
    }
  }
  return { ok: false, error: "Kamar sedang diproses. Muat ulang halaman." };
}

export async function inspectRoom(formData: FormData): Promise<ActionResult> {
  const operator = await requireHousekeeperMember();
  if (!operator) return { ok: false, error: "Tidak berwenang" };
  const parsed = InspectRoomSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: validationError(parsed.error) };
  const result = await inspectRoomOperation({ ...operator, ...parsed.data });
  if (result.ok) revalidateRoomPaths(parsed.data.roomId);
  return result;
}
