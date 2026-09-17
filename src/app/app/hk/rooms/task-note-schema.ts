import { z } from "zod";

import { isValidISODateOnly } from "@/lib/date-only";

export const TASK_NOTE_CATEGORIES = [
  "Pembersihan Khusus",
  "Tambahan Amenities",
  "Perbaikan Ringan",
  "Layanan Kamar",
  "Lainnya",
] as const;

export type ActionResult = { ok: true } | { ok: false; error: string };

function positiveId(message: string) {
  return z.number({ error: message }).int(message).positive(message).max(2147483647, message);
}

function formId(message: string) {
  return z.string({ error: message })
    .regex(/^[1-9]\d*$/, message)
    .transform(Number)
    .pipe(positiveId(message));
}

export const SetRoomHousekeeperSchema = z.object({
  roomId: positiveId("Kamar tidak valid"),
  dateIso: z.string({ error: "Tanggal tidak valid" }).refine(
    (value) => isValidISODateOnly(value) && !value.startsWith("0000-"),
    "Tanggal tidak valid",
  ),
  housekeeperId: positiveId("Petugas HK tidak valid").nullable(),
});

export const TaskNoteSchema = z.object({
  roomId: formId("Kamar tidak valid"),
  category: z.enum(TASK_NOTE_CATEGORIES, { error: "Kategori tugas tidak valid" }),
  note: z.string({ error: "Catatan tidak valid" }).trim()
    .min(3, "Catatan minimal 3 karakter")
    .max(2000, "Catatan maksimal 2000 karakter"),
  housekeeperId: z.preprocess(
    (value) => value === null || value === "" ? undefined : value,
    formId("Petugas HK tidak valid").optional(),
  ),
});
