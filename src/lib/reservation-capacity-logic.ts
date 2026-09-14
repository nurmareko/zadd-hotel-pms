import { addDateOnlyDays, parseISODateOnly } from "@/lib/date-only";
import type { RoomBlockDateRange } from "@/lib/room-blocks/overlap";

export type DailyRoomTypeCapacity = {
  date: string;
  roomCount: number;
  blockedCount: number;
  reservationCount: number;
  available: number;
};

/** Inputs are already scoped to one room type and active reservations. No Room.status dependency. */
export function computeDailyRoomTypeCapacity({ range, roomCount, reservations, blocks }: {
  range: RoomBlockDateRange;
  roomCount: number;
  reservations: readonly { arrivalDate: string; departureDate: string }[];
  blocks: readonly (RoomBlockDateRange & { roomId: number; status: string })[];
}): DailyRoomTypeCapacity[] {
  const days: DailyRoomTypeCapacity[] = [];
  const end = parseISODateOnly(range.endDate);
  for (let date = parseISODateOnly(range.startDate); date < end; date = addDateOnlyDays(date, 1)) {
    const iso = date.toISOString().slice(0, 10);
    const reservationCount = reservations.filter((stay) => stay.arrivalDate <= iso && stay.departureDate > iso).length;
    const blockedCount = new Set(blocks.filter((block) => block.status === "ACTIVE" && block.startDate <= iso && block.endDate > iso).map((block) => block.roomId)).size;
    days.push({ date: iso, roomCount, reservationCount, blockedCount, available: roomCount - reservationCount - blockedCount });
  }
  return days;
}
