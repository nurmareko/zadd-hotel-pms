import type { Prisma, RoomBlockReason, RoomBlockStatus } from "@prisma/client";
import { isValidISODateOnly, parseISODateOnly } from "@/lib/date-only";
import { ROOM_BLOCK_REASON_LABELS } from "@/lib/room-blocks/overlap";

export const BLOCK_STATUS_LABELS: Record<RoomBlockStatus | "ALL", string> = {
  ALL: "All statuses", ACTIVE: "Active", RELEASED: "Released",
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
    return { ok: false, error: "Each filter may have only one value." };
  }
  const value = (key: typeof keys[number]) => (params[key] as string | undefined)?.trim() ?? "";
  const q = value("q");
  const startDate = value("startDate");
  const endDate = value("endDate");
  const reason = value("reason") || "ALL";
  const status = value("status") || "ALL";
  if (q.length > 100) return { ok: false, error: "Room searches must not exceed 100 characters." };
  if ((startDate && !isValidISODateOnly(startDate)) || (endDate && !isValidISODateOnly(endDate))) {
    return { ok: false, error: "Filter dates must be valid calendar dates (YYYY-MM-DD)." };
  }
  if (startDate && endDate && startDate >= endDate) {
    return { ok: false, error: "The filter end date must be after the start date." };
  }
  if (reason !== "ALL" && !Object.hasOwn(ROOM_BLOCK_REASON_LABELS, reason)) {
    return { ok: false, error: "Select a valid reason for the room block." };
  }
  if (!Object.hasOwn(BLOCK_STATUS_LABELS, status)) {
    return { ok: false, error: "Select a valid room block status." };
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
