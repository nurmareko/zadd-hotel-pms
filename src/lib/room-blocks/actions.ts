"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  checkActionAuthorization,
  logActionFailure,
  rethrowFrameworkErrors,
  runPostCommitSideEffects,
} from "@/lib/action-errors";
import { revalidateRoomStatusViews } from "@/lib/revalidate-room-status";
import { RoomBlockError, type RoomBlockActionResult } from "./errors";
import { createRoomBlock, releaseRoomBlock } from "./operations";
import { CreateRoomBlockSchema, ReleaseRoomBlockSchema } from "./schema";

async function runRoomBlockAction(kind: "create" | "release", input: unknown): Promise<RoomBlockActionResult> {
  try {
    const session = await auth();
    const denied = checkActionAuthorization(session, "room_blocks:manage");
    if (denied) return denied;
    const operatorId = Number(session?.user?.id);
    if (!Number.isSafeInteger(operatorId) || operatorId <= 0) {
      return { ok: false, code: "SESSION_EXPIRED", error: "Sesi Anda telah berakhir. Silakan masuk kembali." };
    }
    const raw = input instanceof FormData ? Object.fromEntries(input) : input;
    let result: Extract<RoomBlockActionResult, { ok: true }>;
    if (kind === "create") {
      const parsed = CreateRoomBlockSchema.safeParse(raw);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const field = String(issue.path[0] ?? "");
        const messages: Record<string, string> = {
          roomId: "Pilih kamar yang valid.",
          startDate: "Tanggal mulai harus berupa tanggal kalender yang valid (YYYY-MM-DD).",
          endDate: "Tanggal selesai harus valid dan setelah tanggal mulai.",
          reason: "Pilih alasan blokir kamar yang valid.",
          note: "Catatan harus berupa teks maksimal 2000 karakter.",
        };
        return {
          ok: false,
          code: "INVALID_INPUT",
          field,
          error: messages[field] ?? "Data blokir tidak valid. Periksa kembali formulir.",
        };
      }
      result = await createRoomBlock(parsed.data, operatorId);
    } else {
      const parsed = ReleaseRoomBlockSchema.safeParse(raw);
      if (!parsed.success) return { ok: false, code: "INVALID_INPUT", field: "blockId", error: "Pilih blokir kamar yang valid." };
      result = await releaseRoomBlock(parsed.data.blockId, operatorId);
    }
    await runPostCommitSideEffects([
      { name: "room-status", run: () => revalidateRoomStatusViews({ roomId: result.roomId }) },
      { name: "reservation-availability", run: () => revalidatePath("/app/fo/reservasi", "layout") },
    ], { action: `${kind}RoomBlock`, committed: true });
    return result;
  } catch (error) {
    rethrowFrameworkErrors(error);
    if (error instanceof RoomBlockError) return { ok: false, code: error.code, error: error.message };
    logActionFailure(`${kind}RoomBlock`, error);
    return { ok: false, code: "UNEXPECTED", error: "Blokir kamar tidak dapat diproses. Silakan coba lagi." };
  }
}

export async function createRoomBlockAction(input: unknown): Promise<RoomBlockActionResult> {
  return runRoomBlockAction("create", input);
}
export async function releaseRoomBlockAction(input: unknown): Promise<RoomBlockActionResult> {
  return runRoomBlockAction("release", input);
}
