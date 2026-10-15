import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { allocateLostFoundReference, isLostFoundReferenceConflict } from "./reference-allocation";
import type { CreateLostFoundItemSchema, DisposeLostFoundItemSchema, LostFoundActionResult, ReturnLostFoundItemSchema } from "./schema";

export type LostFoundOperator = { userId: number; role: "HK" | "FO" | "ADMIN" };
type OperationResult = (Extract<LostFoundActionResult, { ok: true }> & { roomId: number | null }) | Extract<LostFoundActionResult, { ok: false }>;
class LostFoundError extends Error {}
const conflictMessage = "The found item is being processed by another staff member. Reload the page and try again.";

async function requireCurrentOperator(tx: Prisma.TransactionClient, operator: LostFoundOperator) {
  if (!Number.isSafeInteger(operator.userId) || operator.userId <= 0 || operator.userId > 2147483647 || !["HK", "FO", "ADMIN"].includes(operator.role)) {
    throw new LostFoundError("You do not have access to manage lost and found.");
  }
  const user = await tx.user.findFirst({
    where: { id: operator.userId, isActive: true, roles: { some: { role: { code: operator.role } } } },
    select: { id: true },
  });
  if (!user) throw new LostFoundError("Your account is inactive or lost-and-found access has changed. Please sign in again.");
}

async function runTransaction(fallback: string, operation: (tx: Prisma.TransactionClient) => Promise<Extract<OperationResult, { ok: true }>>): Promise<OperationResult> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(operation, { ...TRANSACTION_OPTIONS, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof LostFoundError) return { ok: false, error: error.message };
      const retryable = isLostFoundReferenceConflict(error) || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034");
      if (retryable && attempt < 2) continue;
      if (retryable || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2028")) return { ok: false, error: conflictMessage };
      return { ok: false, error: fallback };
    }
  }
  return { ok: false, error: conflictMessage };
}

export async function createLostFoundItemOperation(operator: LostFoundOperator, input: z.infer<typeof CreateLostFoundItemSchema>): Promise<OperationResult> {
  return runTransaction("Failed to record the found item. Please try again.", async (tx) => {
    if (input.roomId !== null) {
      await tx.$queryRaw`SELECT id FROM "room" WHERE id = ${input.roomId} FOR UPDATE`;
      const room = await tx.room.findUnique({ where: { id: input.roomId }, select: { id: true } });
      if (!room) throw new LostFoundError("Room not found. Select another room or clear the room selection.");
    }
    await requireCurrentOperator(tx, operator);
    const allocation = await allocateLostFoundReference(tx);
    const item = await tx.lostFoundItem.create({
      data: { ...input, ...allocation, foundById: operator.userId, status: "UNCLAIMED" },
      select: { id: true, referenceCode: true, roomId: true },
    });
    return { ok: true, itemId: item.id, referenceCode: item.referenceCode, roomId: item.roomId };
  });
}

async function lockUnclaimedItem(tx: Prisma.TransactionClient, itemId: number, operator: LostFoundOperator) {
  await tx.$queryRaw`SELECT id FROM "lost_found_item" WHERE id = ${itemId} FOR UPDATE`;
  await requireCurrentOperator(tx, operator);
  const item = await tx.lostFoundItem.findUnique({ where: { id: itemId }, select: { id: true, referenceCode: true, roomId: true, status: true } });
  if (!item) throw new LostFoundError("Found item not found.");
  if (item.status === "RETURNED") throw new LostFoundError("The item has been returned and cannot be processed again.");
  if (item.status === "DISPOSED") throw new LostFoundError("The item has been disposed of or donated and cannot be processed again.");
  if (item.status !== "UNCLAIMED") throw new LostFoundError("Only unclaimed items can be processed.");
  return item;
}

export async function claimLostFoundItemOperation(operator: LostFoundOperator, input: z.infer<typeof ReturnLostFoundItemSchema>): Promise<OperationResult> {
  return runTransaction("Failed to record the item return. Please try again.", async (tx) => {
    const item = await lockUnclaimedItem(tx, input.itemId, operator);
    const { itemId, ...claim } = input;
    const updated = await tx.lostFoundItem.updateMany({
      where: { id: itemId, status: "UNCLAIMED" },
      data: { ...claim, status: "RETURNED", returnedById: operator.userId, returnedAt: new Date() },
    });
    if (updated.count !== 1) throw new LostFoundError(conflictMessage);
    return { ok: true, itemId: item.id, referenceCode: item.referenceCode, roomId: item.roomId };
  });
}

export async function disposeLostFoundItemOperation(operator: LostFoundOperator, input: z.infer<typeof DisposeLostFoundItemSchema>): Promise<OperationResult> {
  return runTransaction("Failed to record the item disposal/donation. Please try again.", async (tx) => {
    const item = await lockUnclaimedItem(tx, input.itemId, operator);
    const disposalReason = input.notes ? `${input.disposalReason}\nNotes: ${input.notes}` : input.disposalReason;
    const updated = await tx.lostFoundItem.updateMany({
      where: { id: item.id, status: "UNCLAIMED" },
      data: { status: "DISPOSED", disposalReason, disposedById: operator.userId, disposedAt: new Date() },
    });
    if (updated.count !== 1) throw new LostFoundError(conflictMessage);
    return { ok: true, itemId: item.id, referenceCode: item.referenceCode, roomId: item.roomId };
  });
}
