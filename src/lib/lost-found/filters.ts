import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { addDateOnlyDays, hotelTimestampBoundaryForDate, isValidISODateOnly, parseISODateOnly } from "@/lib/date-only";
import { lostFoundCategorySchema, lostFoundStatusSchema } from "./schema";

const dateFilter = z.string({ error: "Tanggal tidak valid." }).refine((value) => value === "" || isValidISODateOnly(value), "Tanggal tidak valid.").optional();
export const LostFoundFiltersSchema = z.object({
  q: z.string({ error: "Pencarian tidak valid." }).trim().max(200, "Pencarian maksimal 200 karakter.").optional(),
  category: z.union([lostFoundCategorySchema, z.literal("")]).optional(),
  status: z.union([lostFoundStatusSchema, z.literal("")]).optional(),
  room: z.string({ error: "Nomor kamar tidak valid." }).trim().max(20, "Nomor kamar maksimal 20 karakter.").optional(),
  from: dateFilter,
  to: dateFilter,
}).refine((value) => !value.from || !value.to || value.from <= value.to, {
  message: "Tanggal akhir tidak boleh sebelum tanggal awal.", path: ["to"],
});
export type LostFoundFilters = z.infer<typeof LostFoundFiltersSchema>;

/** Invalid filters throw ZodError; UI/export callers must show its Indonesian message. */
export function parseLostFoundFilters(params: Record<string, string | string[] | undefined>): LostFoundFilters {
  return LostFoundFiltersSchema.parse(Object.fromEntries(Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])));
}

/** Inclusive hotel-local logged dates, represented as a half-open timestamp range. */
export function buildLostFoundWhere(input: LostFoundFilters = {}): Prisma.LostFoundItemWhereInput {
  const filters = LostFoundFiltersSchema.parse(input);
  const where: Prisma.LostFoundItemWhereInput = {};
  if (filters.q) {
    const contains = { contains: filters.q, mode: "insensitive" as const };
    where.OR = [
      { referenceCode: contains }, { description: contains }, { claimantName: contains },
      { claimantPhone: contains }, { locationDetails: contains }, { room: { number: contains } },
    ];
  }
  if (filters.category) where.category = filters.category;
  if (filters.status) where.status = filters.status;
  if (filters.room) where.room = { number: { contains: filters.room, mode: "insensitive" } };
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: hotelTimestampBoundaryForDate(filters.from) } : {}),
      ...(filters.to ? { lt: hotelTimestampBoundaryForDate(addDateOnlyDays(parseISODateOnly(filters.to), 1).toISOString().slice(0, 10)) } : {}),
    };
  }
  return where;
}
