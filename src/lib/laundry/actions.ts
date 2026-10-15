"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import type { AppRole } from "@/auth.config";
import { can } from "@/lib/permissions";
import type { ActionResult } from "@/lib/action-errors";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import {
  AdvanceLinenBatchStatusSchema, appendReceiptNotes, CreateLinenBatchSchema,
  generateLinenBatchCode, getLaundryCodeMonth, ReceiveLinenBatchSchema, reconcileLinenBatch,
} from "./logic";

export type LaundryActionResult = ActionResult;
type LaundryOperator = { userId: number; role: AppRole };
class LaundryError extends Error {}
const conflictMessage = "The shipment is being processed. Reload the page and try again.";

async function requireLaundryOperator(): Promise<LaundryOperator | null> {
  const session = await auth();
  if (!session?.user || !can(session.user.role as AppRole, "laundry:manage")) return null;
  const userId = Number(session.user.id);
  if (!Number.isSafeInteger(userId) || userId <= 0 || userId > 2147483647) return null;
  return { userId, role: session.user.role as AppRole };
}

async function requireCurrentOperator(tx: Prisma.TransactionClient, operator: LaundryOperator) {
  const user = await tx.user.findFirst({
    where: { id: operator.userId, isActive: true, roles: { some: { role: { code: operator.role } } } },
    select: { id: true },
  });
  if (!user) throw new LaundryError("Not authorized to manage laundry.");
}

function isRetryable(error: unknown, creating: boolean): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  // PostgreSQL can report serialization/deadlock failures from raw locking SQL as P2010.
  return error.code === "P2034" || error.code === "P2028" ||
    (creating && error.code === "P2002") ||
    (error.code === "P2010" && (error.meta?.code === "40001" || error.meta?.code === "40P01"));
}

async function runTransaction(operation: (tx: Prisma.TransactionClient) => Promise<void>, creating = false): Promise<LaundryActionResult> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await prisma.$transaction(operation, { ...TRANSACTION_OPTIONS, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return { ok: true };
    } catch (error) {
      if (error instanceof LaundryError) return { ok: false, code: "LAUNDRY_ERROR", error: error.message };
      if (isRetryable(error, creating)) {
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
          continue;
        }
        return { ok: false, code: "CONFLICT", error: conflictMessage };
      }
      return { ok: false, code: "UNEXPECTED", error: "Failed to save the laundry shipment. Please try again." };
    }
  }
  return { ok: false, code: "CONFLICT", error: conflictMessage };
}

async function lockBatch(tx: Prisma.TransactionClient, batchId: string) {
  await tx.$queryRaw`SELECT id FROM linen_batch WHERE id = ${batchId} FOR UPDATE`;
  const batch = await tx.linenBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new LaundryError("Laundry shipment not found.");
  return batch;
}

function requireOne(result: { count: number }) {
  if (result.count !== 1) throw new LaundryError(conflictMessage);
}

async function createBatchOperation(input: z.infer<typeof CreateLinenBatchSchema>, operator: LaundryOperator) {
  return runTransaction(async (tx) => {
    // A global, transaction-scoped laundry lock also covers the first batch of a month.
    // SERIALIZABLE may retain a pre-lock snapshot: unique conflicts must restart the entire transaction.
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext('laundry-batch-code'))`;
    await requireCurrentOperator(tx, operator);
    const sentAt = new Date();
    const month = getLaundryCodeMonth(sentAt);
    const count = await tx.linenBatch.count({ where: { sentAt: { gte: month.start, lt: month.end } } });
    if (count >= 9999) throw new LaundryError("The shipment number for this month has reached the limit.");
    await tx.linenBatch.create({
      data: { ...input, batchCode: generateLinenBatchCode(sentAt, count), sentAt, status: "SENT", recordedById: operator.userId },
    });
  }, true);
}

async function advanceBatchOperation(input: z.infer<typeof AdvanceLinenBatchStatusSchema>, operator: LaundryOperator) {
  return runTransaction(async (tx) => {
    const batch = await lockBatch(tx, input.batchId);
    await requireCurrentOperator(tx, operator);
    if (batch.status !== "SENT") throw new LaundryError("Only shipments with Sent status can start washing.");
    requireOne(await tx.linenBatch.updateMany({ where: { id: batch.id, status: "SENT" }, data: { status: "WASHING" } }));
  });
}

async function receiveBatchOperation(input: z.infer<typeof ReceiveLinenBatchSchema>, operator: LaundryOperator) {
  return runTransaction(async (tx) => {
    const batch = await lockBatch(tx, input.batchId);
    await requireCurrentOperator(tx, operator);
    if (batch.status !== "SENT" && batch.status !== "WASHING") throw new LaundryError("This laundry shipment has already been received.");
    try {
      reconcileLinenBatch(batch.sentQuantity, input.receivedQuantity, input.damagedQuantity);
    } catch {
      throw new LaundryError("Received and damaged quantities must not exceed the sent quantity.");
    }
    requireOne(await tx.linenBatch.updateMany({
      where: { id: batch.id, status: batch.status },
      data: {
        status: "CLEAN", receivedQuantity: input.receivedQuantity, damagedQuantity: input.damagedQuantity,
        completedAt: new Date(), receivedById: operator.userId, notes: appendReceiptNotes(batch.notes, input.notes),
      },
    }));
  });
}

async function submit<T>(formData: FormData, schema: z.ZodType<T>, operation: (input: T, operator: LaundryOperator) => Promise<LaundryActionResult>): Promise<LaundryActionResult> {
  const operator = await requireLaundryOperator();
  if (!operator) return { ok: false, code: "FORBIDDEN", error: "Not authorized to manage laundry." };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT", error: parsed.error.issues[0]?.message ?? "Invalid shipment data." };
  const result = await operation(parsed.data, operator);
  if (result.ok) revalidatePath("/app/hk/laundry");
  return result;
}

/** FormData: itemType, sentQuantity, optional vendor and notes. */
export async function createLinenBatch(formData: FormData): Promise<LaundryActionResult> {
  return submit(formData, CreateLinenBatchSchema, createBatchOperation);
}

/** FormData: batchId (cuid). Only SENT → WASHING is allowed. */
export async function advanceLinenBatchStatus(formData: FormData): Promise<LaundryActionResult> {
  return submit(formData, AdvanceLinenBatchStatusSchema, advanceBatchOperation);
}

/** FormData: batchId, receivedQuantity (usable), damagedQuantity, optional notes. */
export async function receiveLinenBatch(formData: FormData): Promise<LaundryActionResult> {
  return submit(formData, ReceiveLinenBatchSchema, receiveBatchOperation);
}
