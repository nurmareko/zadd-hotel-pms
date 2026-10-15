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
      return { ok: false, code: "SESSION_EXPIRED", error: "Your session has expired. Please sign in again." };
    }
    const raw = input instanceof FormData ? Object.fromEntries(input) : input;
    let result: Extract<RoomBlockActionResult, { ok: true }>;
    if (kind === "create") {
      const parsed = CreateRoomBlockSchema.safeParse(raw);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const field = String(issue.path[0] ?? "");
        const messages: Record<string, string> = {
          roomId: "Select a valid room.",
          startDate: "Start date must be a valid calendar date (YYYY-MM-DD).",
          endDate: "End date must be valid and after the start date.",
          reason: "Select a valid room block reason.",
          note: "Notes must be text of at most 2000 characters.",
        };
        return {
          ok: false,
          code: "INVALID_INPUT",
          field,
          error: messages[field] ?? "Invalid block data. Please review the form.",
        };
      }
      result = await createRoomBlock(parsed.data, operatorId);
    } else {
      const parsed = ReleaseRoomBlockSchema.safeParse(raw);
      if (!parsed.success) return { ok: false, code: "INVALID_INPUT", field: "blockId", error: "Select a valid room block." };
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
    return { ok: false, code: "UNEXPECTED", error: "The room block could not be processed. Please try again." };
  }
}

export async function createRoomBlockAction(input: unknown): Promise<RoomBlockActionResult> {
  return runRoomBlockAction("create", input);
}
export async function releaseRoomBlockAction(input: unknown): Promise<RoomBlockActionResult> {
  return runRoomBlockAction("release", input);
}
