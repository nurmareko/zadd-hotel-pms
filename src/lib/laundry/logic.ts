import type { LinenBatchStatus, LinenItemType, Prisma } from "@prisma/client";
import { z } from "zod";
import { addDateOnlyDays, hotelTimestampBoundaryForDate, hotelTodayISO, isValidISODateOnly, parseISODateOnly } from "@/lib/date-only";

export const LINEN_ITEM_LABELS: Record<LinenItemType, string> = {
  BED_SHEET: "Bed Sheet", DUVET_COVER: "Duvet Cover", PILLOW_CASE: "Pillowcase",
  BATH_TOWEL: "Bath Towel", HAND_TOWEL: "Hand Towel", BATH_MAT: "Bath Mat", OTHER: "Other",
};
export const LINEN_STATUS_LABELS: Record<LinenBatchStatus, string> = {
  SENT: "Sent / Awaiting Wash", WASHING: "Washing", CLEAN: "Clean / In Storage",
};
const itemTypeSchema = z.enum(["BED_SHEET", "DUVET_COVER", "PILLOW_CASE", "BATH_TOWEL", "HAND_TOWEL", "BATH_MAT", "OTHER"], { error: "Invalid linen type." });
const statusSchema = z.enum(["SENT", "WASHING", "CLEAN"], { error: "Invalid linen status." });
const MAX_INT = 2147483647;

function quantitySchema(min: number) {
  const message = min === 1 ? "Sent quantity must be a positive whole number." : "Received and damaged quantities must be nonnegative whole numbers.";
  return z.preprocess(
    (value) => typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value.trim()) : value,
    z.number({ error: message }).int({ error: message }).min(min, { error: message }).max(MAX_INT, { error: "Quantity exceeds the allowed limit." }),
  );
}
const optionalText = (max: number) => z.string({ error: "Invalid notes or vendor." }).trim().max(max, { error: `Text must be at most ${max} characters.` }).nullish().transform((value) => value || null);
export const CreateLinenBatchSchema = z.object({
  itemType: itemTypeSchema, sentQuantity: quantitySchema(1), vendor: optionalText(200), notes: optionalText(2000),
});
export const AdvanceLinenBatchStatusSchema = z.object({ batchId: z.string({ error: "Invalid shipment ID." }).cuid({ error: "Invalid shipment ID." }) });
export const ReceiveLinenBatchSchema = AdvanceLinenBatchStatusSchema.extend({
  receivedQuantity: quantitySchema(0), damagedQuantity: quantitySchema(0), notes: optionalText(2000),
});

const dateFilter = z.string({ error: "Invalid date." }).refine((value) => value === "" || isValidISODateOnly(value), "Invalid date.").optional();
export const LaundryFiltersSchema = z.object({
  q: z.string({ error: "Invalid search." }).trim().max(200, "Search must be at most 200 characters.").optional(),
  status: z.union([statusSchema, z.literal("")]).optional(),
  itemType: z.union([itemTypeSchema, z.literal("")]).optional(),
  dateFrom: dateFilter, dateTo: dateFilter,
}).refine((value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo, {
  message: "End date must not be before the start date.", path: ["dateTo"],
});

/** Inclusive hotel-local dispatch dates; empty strings mean no filter. */
export type LaundryFilters = z.infer<typeof LaundryFiltersSchema>;

export function buildLaundryWhere(input: LaundryFilters = {}): Prisma.LinenBatchWhereInput {
  const filters = LaundryFiltersSchema.parse(input);
  const where: Prisma.LinenBatchWhereInput = {};
  if (filters.q) {
    where.OR = ["batchCode", "vendor", "notes"].map((key) => ({ [key]: { contains: filters.q, mode: "insensitive" } }));
  }
  if (filters.status) where.status = filters.status;
  if (filters.itemType) where.itemType = filters.itemType;
  if (filters.dateFrom || filters.dateTo) {
    where.sentAt = {
      ...(filters.dateFrom ? { gte: hotelTimestampBoundaryForDate(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { lt: hotelTimestampBoundaryForDate(addDateOnlyDays(parseISODateOnly(filters.dateTo), 1).toISOString().slice(0, 10)) } : {}),
    };
  }
  return where;
}

export function reconcileLinenBatch(sentQuantity: number, receivedQuantity: number | null, damagedQuantity: number) {
  if (!Number.isInteger(sentQuantity) || sentQuantity <= 0 || sentQuantity > MAX_INT ||
      !Number.isInteger(damagedQuantity) || damagedQuantity < 0 || damagedQuantity > sentQuantity ||
      (receivedQuantity !== null && (!Number.isInteger(receivedQuantity) || receivedQuantity < 0 || receivedQuantity + damagedQuantity > sentQuantity))) {
    throw new Error("Received and damaged quantities must not exceed the sent quantity; all quantities must be valid whole numbers.");
  }
  return { lostQuantity: receivedQuantity === null ? null : sentQuantity - receivedQuantity - damagedQuantity, isReconciled: receivedQuantity !== null };
}

export function appendReceiptNotes(dispatchNotes: string | null, receiptNotes?: string | null): string | null {
  const receipt = receiptNotes?.trim();
  return receipt ? [dispatchNotes, `Receipt notes: ${receipt}`].filter(Boolean).join("\n") : dispatchNotes;
}

export function getLaundryCodeMonth(now: Date) {
  const iso = hotelTodayISO(now);
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return {
    prefix: `LND-${iso.slice(2, 4)}${iso.slice(5, 7)}-`,
    start: hotelTimestampBoundaryForDate(`${iso.slice(0, 7)}-01`),
    end: hotelTimestampBoundaryForDate(nextMonth),
  };
}

/** count is the number already dispatched in this hotel-local month. */
export function generateLinenBatchCode(now: Date, count: number): string {
  if (!Number.isInteger(count) || count < 0 || count >= 9999) throw new Error("The monthly shipment number is invalid or has reached the limit.");
  return `${getLaundryCodeMonth(now).prefix}${String(count + 1).padStart(4, "0")}`;
}

export function formatLaundryQuantity(quantity: number): string {
  return new Intl.NumberFormat("id-ID").format(quantity);
}

export function formatLaundryDate(value: Date | string | null): string {
  if (value === null) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}
