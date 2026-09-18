"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { auth } from "@/auth";
import { claimLostFoundItemOperation, createLostFoundItemOperation, disposeLostFoundItemOperation, type LostFoundOperator } from "./operations";
import { ClaimLostFoundItemSchema, CreateLostFoundItemSchema, DisposeLostFoundItemSchema, ReturnLostFoundItemSchema, type LostFoundActionResult } from "./schema";

async function execute<T>(
  formData: FormData,
  schema: z.ZodType<T>,
  operation: (operator: LostFoundOperator, input: T) => Promise<LostFoundActionResult & { roomId?: number | null }>,
): Promise<LostFoundActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Silakan masuk terlebih dahulu." };
  const { role } = session.user;
  const userId = Number(session.user.id);
  if ((role !== "HK" && role !== "FO" && role !== "ADMIN") || !Number.isSafeInteger(userId) || userId <= 0 || userId > 2147483647) {
    return { ok: false, error: "Anda tidak memiliki akses untuk mengelola barang temuan." };
  }
  if (!(formData instanceof FormData)) return { ok: false, error: "Data formulir tidak valid." };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data formulir tidak valid." };
  const result = await operation({ userId, role }, parsed.data);
  if (!result.ok) return result;
  revalidatePath("/app/hk/lost-found");
  revalidatePath("/app/hk/mobile");
  revalidatePath("/app/hk/rooms");
  if (result.roomId != null) revalidatePath(`/app/hk/rooms/${result.roomId}`);
  return { ok: true, itemId: result.itemId, referenceCode: result.referenceCode };
}

export async function createLostFoundItem(formData: FormData): Promise<LostFoundActionResult> {
  return execute(formData, CreateLostFoundItemSchema, createLostFoundItemOperation);
}

export async function claimLostFoundItem(formData: FormData): Promise<LostFoundActionResult> {
  return execute(formData, ClaimLostFoundItemSchema, claimLostFoundItemOperation);
}

export async function disposeLostFoundItem(formData: FormData): Promise<LostFoundActionResult> {
  return execute(formData, DisposeLostFoundItemSchema, disposeLostFoundItemOperation);
}

/** Compatibility for resolution-only return forms; uses the same guarded transition. */
export async function markLostFoundItemReturned(formData: FormData): Promise<LostFoundActionResult> {
  return execute(formData, ReturnLostFoundItemSchema, claimLostFoundItemOperation);
}
