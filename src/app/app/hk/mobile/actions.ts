"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  claimAvailableRoomOperation,
  finishCleaningOperation,
  inspectRoomOperation,
  reportFloorLostFoundOperation,
  startCleaningOperation,
  type CleaningOperator,
  type CleaningResult,
} from "@/lib/housekeeping/cleaning-operations";
import { revalidateRoomStatusViews } from "@/lib/revalidate-room-status";
import { FloorLostFoundSchema, MobileFinishSchema, MobileInspectSchema, MobileRoomIdSchema } from "./schema";

async function requireOperator(): Promise<CleaningOperator | null> {
  const session = await auth();
  if (session?.user.role !== "HK" && session?.user.role !== "ADMIN") return null;
  const userId = Number(session.user.id);
  if (!Number.isSafeInteger(userId) || userId <= 0 || userId > 2147483647) return null;
  return { userId, role: session.user.role };
}

function validationError(error: { issues: { message: string }[] }): CleaningResult {
  return { ok: false, error: error.issues[0]?.message ?? "Input tidak valid" };
}

function revalidateRoom(roomId?: number) {
  revalidateRoomStatusViews({ roomId });
  revalidatePath("/app/hk/clean");
}

export async function startMobileCleaning(roomId: number): Promise<CleaningResult> {
  const operator = await requireOperator();
  if (!operator) return { ok: false, error: "Tidak berwenang" };
  const parsed = MobileRoomIdSchema.safeParse(roomId);
  if (!parsed.success) return validationError(parsed.error);
  const result = await startCleaningOperation({ ...operator, roomId: parsed.data });
  if (result.ok) revalidateRoom(parsed.data);
  return result;
}

export async function finishMobileCleaning(formData: FormData): Promise<CleaningResult> {
  const operator = await requireOperator();
  if (!operator) return { ok: false, error: "Tidak berwenang" };
  if (!(formData instanceof FormData)) return { ok: false, error: "Input tidak valid" };
  const parsed = MobileFinishSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const result = await finishCleaningOperation({ ...operator, ...parsed.data });
  if (result.ok) revalidateRoom(parsed.data.roomId);
  return result;
}

export async function inspectMobileRoom(roomId: number, passed: boolean, notes?: string): Promise<CleaningResult> {
  const operator = await requireOperator();
  if (!operator) return { ok: false, error: "Tidak berwenang" };
  const parsed = MobileInspectSchema.safeParse({ roomId, passed, notes });
  if (!parsed.success) return validationError(parsed.error);
  const result = await inspectRoomOperation({ ...operator, ...parsed.data });
  if (result.ok) revalidateRoom(parsed.data.roomId);
  return result;
}

export async function claimAvailableRoom(roomId: number): Promise<CleaningResult> {
  const operator = await requireOperator();
  if (!operator) return { ok: false, error: "Tidak berwenang" };
  const parsed = MobileRoomIdSchema.safeParse(roomId);
  if (!parsed.success) return validationError(parsed.error);
  const result = await claimAvailableRoomOperation({ ...operator, roomId: parsed.data });
  if (result.ok) revalidateRoom(parsed.data);
  return result;
}

export async function reportFloorLostFound(formData: FormData): Promise<CleaningResult> {
  const operator = await requireOperator();
  if (!operator) return { ok: false, error: "Tidak berwenang" };
  if (!(formData instanceof FormData)) return { ok: false, error: "Input tidak valid" };
  const parsed = FloorLostFoundSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const result = await reportFloorLostFoundOperation({ ...operator, ...parsed.data });
  if (result.ok) {
    revalidatePath("/app/hk/lost-found");
    revalidateRoom(parsed.data.roomId ?? undefined);
  }
  return result;
}
