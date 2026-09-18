import type { LinenBatchStatus, LinenItemType, Prisma } from "@prisma/client";
import { z } from "zod";
import { addDateOnlyDays, hotelTimestampBoundaryForDate, hotelTodayISO, isValidISODateOnly, parseISODateOnly } from "@/lib/date-only";

export const LINEN_ITEM_LABELS: Record<LinenItemType, string> = {
  BED_SHEET: "Sprei", DUVET_COVER: "Sarung Duvet", PILLOW_CASE: "Sarung Bantal",
  BATH_TOWEL: "Handuk Mandi", HAND_TOWEL: "Handuk Muka", BATH_MAT: "Keset", OTHER: "Lainnya",
};
export const LINEN_STATUS_LABELS: Record<LinenBatchStatus, string> = {
  SENT: "Dikirim / Menunggu Cuci", WASHING: "Sedang Dicuci", CLEAN: "Bersih / Masuk Gudang",
};
const itemTypeSchema = z.enum(["BED_SHEET", "DUVET_COVER", "PILLOW_CASE", "BATH_TOWEL", "HAND_TOWEL", "BATH_MAT", "OTHER"], { error: "Jenis linen tidak valid." });
const statusSchema = z.enum(["SENT", "WASHING", "CLEAN"], { error: "Status linen tidak valid." });
const MAX_INT = 2147483647;

function quantitySchema(min: number) {
  const message = min === 1 ? "Jumlah kirim harus berupa bilangan bulat positif." : "Jumlah penerimaan dan kerusakan harus berupa bilangan bulat nonnegatif.";
  return z.preprocess(
    (value) => typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value.trim()) : value,
    z.number({ error: message }).int({ error: message }).min(min, { error: message }).max(MAX_INT, { error: "Jumlah melebihi batas yang diizinkan." }),
  );
}
const optionalText = (max: number) => z.string({ error: "Catatan atau vendor tidak valid." }).trim().max(max, { error: `Teks maksimal ${max} karakter.` }).nullish().transform((value) => value || null);
export const CreateLinenBatchSchema = z.object({
  itemType: itemTypeSchema, sentQuantity: quantitySchema(1), vendor: optionalText(200), notes: optionalText(2000),
});
export const AdvanceLinenBatchStatusSchema = z.object({ batchId: z.string({ error: "Identitas pengiriman tidak valid." }).cuid({ error: "Identitas pengiriman tidak valid." }) });
export const ReceiveLinenBatchSchema = AdvanceLinenBatchStatusSchema.extend({
  receivedQuantity: quantitySchema(0), damagedQuantity: quantitySchema(0), notes: optionalText(2000),
});

const dateFilter = z.string({ error: "Tanggal tidak valid." }).refine((value) => value === "" || isValidISODateOnly(value), "Tanggal tidak valid.").optional();
export const LaundryFiltersSchema = z.object({
  q: z.string({ error: "Pencarian tidak valid." }).trim().max(200, "Pencarian maksimal 200 karakter.").optional(),
  status: z.union([statusSchema, z.literal("")]).optional(),
  itemType: z.union([itemTypeSchema, z.literal("")]).optional(),
  dateFrom: dateFilter, dateTo: dateFilter,
}).refine((value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo, {
  message: "Tanggal akhir tidak boleh sebelum tanggal awal.", path: ["dateTo"],
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
    throw new Error("Jumlah diterima dan rusak tidak boleh melebihi jumlah kirim; semua jumlah harus berupa bilangan bulat yang valid.");
  }
  return { lostQuantity: receivedQuantity === null ? null : sentQuantity - receivedQuantity - damagedQuantity, isReconciled: receivedQuantity !== null };
}

export function appendReceiptNotes(dispatchNotes: string | null, receiptNotes?: string | null): string | null {
  const receipt = receiptNotes?.trim();
  return receipt ? [dispatchNotes, `Catatan penerimaan: ${receipt}`].filter(Boolean).join("\n") : dispatchNotes;
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
  if (!Number.isInteger(count) || count < 0 || count >= 9999) throw new Error("Nomor pengiriman bulanan tidak valid atau telah mencapai batas.");
  return `${getLaundryCodeMonth(now).prefix}${String(count + 1).padStart(4, "0")}`;
}

export function formatLaundryQuantity(quantity: number): string {
  return new Intl.NumberFormat("id-ID").format(quantity);
}

export function formatLaundryDate(value: Date | string | null): string {
  if (value === null) return "—";
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}
