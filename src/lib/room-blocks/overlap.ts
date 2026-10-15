import type { RoomBlockReason, RoomBlockStatus } from "@prisma/client";

/** Hotel calendar dates (YYYY-MM-DD), end exclusive. Safe to pass to client UI. */
export type RoomBlockDateRange = { startDate: string; endDate: string };
export type RoomBlockSummary = RoomBlockDateRange & {
  id: number;
  roomId: number;
  reason: RoomBlockReason;
  status: RoomBlockStatus;
};

export const ROOM_BLOCK_REASON_LABELS: Record<RoomBlockReason, string> = {
  MAINTENANCE: "Maintenance",
  RENOVATION: "Renovation",
  DEEP_CLEANING: "Deep Cleaning",
  INSPECTION: "Inspection",
  OTHER: "Other",
};

export function overlapsDateRange(a: RoomBlockDateRange, b: RoomBlockDateRange): boolean {
  return a.startDate < a.endDate && b.startDate < b.endDate &&
    a.startDate < b.endDate && a.endDate > b.startDate;
}

export function findOverlappingRoomBlock(
  blocks: readonly RoomBlockSummary[],
  roomId: number,
  range: RoomBlockDateRange,
): RoomBlockSummary | undefined {
  return blocks.find((block) => block.roomId === roomId && block.status === "ACTIVE" && overlapsDateRange(block, range));
}

export function roomBlockedMessage(block: RoomBlockSummary): string {
  return `Room blocked for ${ROOM_BLOCK_REASON_LABELS[block.reason]} from ${block.startDate} until ${block.endDate} (exclusive). Select another room or date.`;
}
