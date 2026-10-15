import { z } from "zod";

import { isValidISODateOnly } from "@/lib/date-only";

export const TASK_NOTE_CATEGORIES = [
  "Pembersihan Khusus",
  "Tambahan Amenities",
  "Perbaikan Ringan",
  "Layanan Kamar",
  "Lainnya",
] as const;

// Keep submitted categories compatible with existing task records.
export const TASK_NOTE_CATEGORY_LABELS: Record<(typeof TASK_NOTE_CATEGORIES)[number], string> = {
  "Pembersihan Khusus": "Special Cleaning",
  "Tambahan Amenities": "Additional Amenities",
  "Perbaikan Ringan": "Minor Repairs",
  "Layanan Kamar": "Room Service",
  Lainnya: "Other",
};

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
  roomId: positiveId("Invalid room"),
  dateIso: z.string({ error: "Invalid date" }).refine(
    (value) => isValidISODateOnly(value) && !value.startsWith("0000-"),
    "Invalid date",
  ),
  housekeeperId: positiveId("Invalid room attendant").nullable(),
});

export const TaskNoteSchema = z.object({
  roomId: formId("Invalid room"),
  category: z.enum(TASK_NOTE_CATEGORIES, { error: "Invalid task category" }),
  note: z.string({ error: "Invalid notes" }).trim()
    .min(3, "Notes must be at least 3 characters")
    .max(2000, "Notes must not exceed 2000 characters"),
  housekeeperId: z.preprocess(
    (value) => value === null || value === "" ? undefined : value,
    formId("Invalid room attendant").optional(),
  ),
});
