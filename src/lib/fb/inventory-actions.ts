"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import type { InventoryMovement } from "./inventory-types";

type ActionResult = { success: true } | { error: string; uncertain?: true };
type QuantityInput = { ingredientId: number; quantity: number; notes?: string };
type StockTakeInput = { ingredientId: number; countedQuantity: number; notes?: string };
type MovementType = "RECEIVE" | "STOCK_TAKE" | "WASTAGE";

const INVENTORY_PATH = "/app/fb/inventory";
const MAX_QUANTITY = new Prisma.Decimal("9999999.999");
const idSchema = z.number().int().positive().max(2147483647);
const quantitySchema = z.number().finite().min(0).max(9999999.999).refine(
  (value) => Number.isFinite(value) && new Prisma.Decimal(value).decimalPlaces() <= 3,
);
const notesSchema = z.string().trim().max(255).optional();
const movementSchema = z.object({
  ingredientId: idSchema,
  quantity: quantitySchema.refine((value) => value > 0),
  notes: notesSchema,
}).strict();
const stockTakeSchema = z.object({
  ingredientId: idSchema,
  countedQuantity: quantitySchema,
  notes: notesSchema,
}).strict();
const forbiddenMessage = "Anda tidak memiliki akses untuk mengelola persediaan.";
const conflictMessage = "Stok berubah bersamaan. Muat ulang halaman dan coba lagi.";
class InventoryError extends Error {}

async function requireOperator(): Promise<number | null> {
  const session = await auth();
  if (!session?.user || !["FB", "ADMIN"].includes(session.user.role)) return null;
  const parsed = idSchema.safeParse(Number(session.user.id));
  return parsed.success ? parsed.data : null;
}

function isSerializationConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && (
    error.code === "P2034" ||
    (error.code === "P2010" && ["40001", "40P01"].includes(String(error.meta?.code)))
  );
}

async function writeMovement(
  input: QuantityInput,
  movementType: MovementType,
  recordedById: number,
): Promise<ActionResult> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await prisma.$transaction(async (tx) => {
        // Lock before reading; a serialization failure restarts this entire snapshot.
        await tx.$queryRaw`SELECT id FROM "fb_ingredient" WHERE id = ${input.ingredientId} FOR UPDATE`;
        const ingredient = await tx.fBIngredient.findUnique({
          where: { id: input.ingredientId },
          select: { id: true, onHand: true },
        });
        if (!ingredient) throw new InventoryError("Bahan tidak ditemukan.");


        const quantity = new Prisma.Decimal(input.quantity);
        const delta = movementType === "STOCK_TAKE"
          ? quantity.minus(ingredient.onHand)
          : movementType === "WASTAGE" ? quantity.negated() : quantity;
        const balance = ingredient.onHand.plus(delta);
        if (delta.abs().gt(MAX_QUANTITY) || balance.abs().gt(MAX_QUANTITY)) {
          throw new InventoryError("Saldo atau perubahan stok melebihi batas yang dapat disimpan.");
        }

        const updated = await tx.fBIngredient.updateMany({
          where: { id: ingredient.id, onHand: ingredient.onHand },
          data: {
            onHand: balance,
            ...(movementType === "STOCK_TAKE" ? { lastCountedAt: new Date() } : {}),
          },
        });
        if (updated.count !== 1) throw new InventoryError(conflictMessage);
        await tx.fBStockLedger.create({
          data: {
            ingredientId: ingredient.id,
            type: movementType,
            quantityDelta: delta,
            balanceAfter: balance,
            notes: input.notes || null,
            recordedById,
          },
        });
      }, { ...TRANSACTION_OPTIONS, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return { success: true };
    } catch (error) {
      if (error instanceof InventoryError) return { error: error.message };
      if (!isSerializationConflict(error)) throw error;
      if (attempt === 2) return { error: conflictMessage };
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
  return { error: conflictMessage };
}

function invalidateCommittedPaths(paths: string[]) {
  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch {
      // A cache failure must not report a committed stock movement as failed:
      // retrying the operator's request would post the quantity a second time.
      console.error("Gagal memperbarui tampilan persediaan setelah perubahan tersimpan.");
    }
  }
}

async function submitMovement(
  input: QuantityInput | StockTakeInput,
  movementType: MovementType,
): Promise<ActionResult> {
  try {
    const operatorId = await requireOperator();
    if (operatorId === null) return { error: forbiddenMessage };
    const parsed = movementType === "STOCK_TAKE"
      ? stockTakeSchema.safeParse(input)
      : movementSchema.safeParse(input);
    if (!parsed.success) {
      return { error: "Data stok tidak valid. Periksa ID bahan, jumlah (maksimal 9.999.999,999 dan tiga angka desimal), serta catatan (maksimal 255 karakter)." };
    }
    const data = parsed.data;
    const result = await writeMovement({
      ingredientId: data.ingredientId,
      quantity: "countedQuantity" in data ? data.countedQuantity : data.quantity,
      notes: data.notes,
    }, movementType, operatorId);
    if ("success" in result) invalidateCommittedPaths([INVENTORY_PATH]);
    return result;
  } catch {
    // A lost COMMIT acknowledgement does not prove rollback. Reconcile before
    // resubmitting a non-idempotent movement rather than risking a duplicate.
    return {
      error: "Status penyimpanan perubahan stok belum dapat dipastikan. Periksa dan cocokkan riwayat stok sebelum mengirim ulang agar tidak tercatat dua kali.",
      uncertain: true,
    };
  }
}

export async function receiveStock(input: QuantityInput): Promise<ActionResult> {
  return submitMovement(input, "RECEIVE");
}

export async function recordStockTake(input: StockTakeInput): Promise<ActionResult> {
  return submitMovement(input, "STOCK_TAKE");
}

export async function recordWastage(input: QuantityInput): Promise<ActionResult> {
  return submitMovement(input, "WASTAGE");
}

export async function toggle86MenuItem(menuItemId: number): Promise<ActionResult> {
  try {
    if (await requireOperator() === null) return { error: forbiddenMessage };
    const parsed = idSchema.safeParse(menuItemId);
    if (!parsed.success) return { error: "ID menu tidak valid." };
    // A single unconditional assignment is atomic and idempotent, not a toggle.
    await prisma.menuItem.update({ where: { id: parsed.data }, data: { isActive: false } });
    invalidateCommittedPaths([INVENTORY_PATH, "/app/fb/pos", "/app/fb/menu"]);
    return { success: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { error: "Menu tidak ditemukan." };
    }
    return { error: "Gagal menonaktifkan menu. Silakan coba lagi." };
  }
}

export async function getStockLedger(
  ingredientId: number,
): Promise<{ movements: InventoryMovement[] } | { error: string }> {
  try {
    if (await requireOperator() === null) return { error: forbiddenMessage };
    const parsed = idSchema.safeParse(ingredientId);
    if (!parsed.success) return { error: "ID bahan tidak valid." };
    const rows = await prisma.fBStockLedger.findMany({
      where: { ingredientId: parsed.data },
      take: 100,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true, type: true, quantityDelta: true, balanceAfter: true,
        notes: true, createdAt: true, recordedBy: { select: { fullName: true } },
      },
    });
    return { movements: rows.map((row) => ({
      id: row.id,
      type: row.type,
      quantityDelta: row.quantityDelta.toNumber(),
      balanceAfter: row.balanceAfter.toNumber(),
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      recordedBy: row.recordedBy.fullName,
    })) };
  } catch {
    return { error: "Gagal memuat riwayat stok. Silakan coba lagi." };
  }
}
