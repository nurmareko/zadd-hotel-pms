import type { Prisma, RoomBlockReason, RoomBlockStatus } from "@prisma/client";
import { isValidISODateOnly, parseISODateOnly } from "@/lib/date-only";
import { ROOM_BLOCK_REASON_LABELS } from "@/lib/room-blocks/overlap";

export const BLOCK_STATUS_LABELS: Record<RoomBlockStatus | "ALL", string> = {
  ALL: "Semua status", ACTIVE: "Aktif", RELEASED: "Dilepas",
};
export type BlockFilters = {
  q: string;
  startDate: string;
  endDate: string;
  reason: RoomBlockReason | "ALL";
  status: RoomBlockStatus | "ALL";
};
export type FilterParams = Record<string, string | string[] | undefined>;

export function parseBlockFilters(params: FilterParams):
  | { ok: true; filters: BlockFilters }
  | { ok: false; error: string } {
  const keys = ["q", "startDate", "endDate", "reason", "status"] as const;
  if (keys.some((key) => Array.isArray(params[key]))) {
    return { ok: false, error: "Setiap filter hanya boleh memiliki satu nilai." };
  }
  const value = (key: typeof keys[number]) => (params[key] as string | undefined)?.trim() ?? "";
  const q = value("q");
  const startDate = value("startDate");
  const endDate = value("endDate");
  const reason = value("reason") || "ALL";
  const status = value("status") || "ALL";
  if (q.length > 100) return { ok: false, error: "Pencarian kamar maksimal 100 karakter." };
  if ((startDate && !isValidISODateOnly(startDate)) || (endDate && !isValidISODateOnly(endDate))) {
    return { ok: false, error: "Tanggal filter harus berupa tanggal kalender yang valid (YYYY-MM-DD)." };
  }
  if (startDate && endDate && startDate >= endDate) {
    return { ok: false, error: "Tanggal selesai filter harus setelah tanggal mulai." };
  }
  if (reason !== "ALL" && !Object.hasOwn(ROOM_BLOCK_REASON_LABELS, reason)) {
    return { ok: false, error: "Pilih alasan blokir kamar yang valid." };
  }
  if (!Object.hasOwn(BLOCK_STATUS_LABELS, status)) {
    return { ok: false, error: "Pilih status blokir kamar yang valid." };
  }
  return { ok: true, filters: { q, startDate, endDate, reason: reason as BlockFilters["reason"], status: status as BlockFilters["status"] } };
}

export function blockFilterWhere(filters: BlockFilters): Prisma.RoomBlockWhereInput {
  return {
    ...(filters.q ? { room: { number: { contains: filters.q, mode: "insensitive" } } } : {}),
    ...(filters.reason !== "ALL" ? { reason: filters.reason } : {}),
    ...(filters.status !== "ALL" ? { status: filters.status } : {}),
    ...(filters.startDate ? { endDate: { gt: parseISODateOnly(filters.startDate) } } : {}),
    ...(filters.endDate ? { startDate: { lt: parseISODateOnly(filters.endDate) } } : {}),
  };
}

export function blockFilterQuery(filters: BlockFilters): string {
  return new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== "" && value !== "ALL")).toString();
}
