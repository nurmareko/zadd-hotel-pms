"use server";

import { RoomStatus } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/auth";
import type { AppRole } from "@/auth.config";
import { can } from "@/lib/permissions";
import { runPostCommitSideEffects } from "@/lib/action-errors";
import { revalidateRoomStatusViews } from "@/lib/revalidate-room-status";
import { RoomBlockError } from "@/lib/room-blocks/errors";
import { setHousekeepingRoomStatus } from "@/lib/room-blocks/operations";

type ActionResult = { ok: true } | { ok: false; error: string };

const UpdateRoomStatusSchema = z.object({
  roomId: z.coerce.number().int().positive("Kamar tidak valid"),
  status: z.enum(RoomStatus),
});

const RoomStatusOverrideSchema = z.object({
  roomId: z.coerce.number().int().positive("Kamar tidak valid"),
  status: z.enum(RoomStatus),
});

function validationError(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Input tidak valid";
}

export async function updateRoomStatus(
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();

  if (!session?.user || !can(session.user.role as AppRole, "rooms:clean")) {
    return { ok: false, error: "Tidak berwenang" };
  }

  const parsed = UpdateRoomStatusSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const userId = Number(session.user.id);
  const { roomId, status } = parsed.data;

  try {
    await setHousekeepingRoomStatus({ roomId, status, source: "board" }, userId);
    await runPostCommitSideEffects([
      { name: "room-status", run: () => revalidateRoomStatusViews({ roomId }) },
    ], { action: "updateRoomStatus", committed: true });
    return { ok: true };
  } catch (error) {
    if (error instanceof RoomBlockError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Gagal memperbarui status kamar" };
  }
}

export async function setRoomStatusOverride(
  roomId: number,
  status: RoomStatus,
): Promise<ActionResult> {
  const session = await auth();

  if (!session?.user || !can(session.user.role as AppRole, "rooms:override_status")) {
    return { ok: false, error: "Tidak berwenang" };
  }

  const parsed = RoomStatusOverrideSchema.safeParse({ roomId, status });

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  try {
    await setHousekeepingRoomStatus({ ...parsed.data, source: "override" }, Number(session.user.id));
    await runPostCommitSideEffects([
      { name: "room-status", run: () => revalidateRoomStatusViews({ roomId: parsed.data.roomId }) },
    ], { action: "setRoomStatusOverride", committed: true });
    return { ok: true };
  } catch (error) {
    if (error instanceof RoomBlockError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Gagal menyimpan perubahan status kamar" };
  }
}
