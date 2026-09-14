import type { Prisma } from "@prisma/client";
import { parseISODateOnly } from "@/lib/date-only";
import { prisma } from "@/lib/prisma";
import type { RoomBlockDateRange, RoomBlockSummary } from "./overlap";

type RoomBlockReader = Pick<Prisma.TransactionClient, "roomBlock" | "reservation">;

export type ActiveRoomBlocksInput = {
  roomId?: number;
  roomTypeId?: number;
  range?: RoomBlockDateRange;
};

export function activeRoomBlockWhere({ roomId, roomTypeId, range }: ActiveRoomBlocksInput): Prisma.RoomBlockWhereInput {
  return {
    status: "ACTIVE",
    ...(roomId !== undefined ? { roomId } : {}),
    ...(roomTypeId !== undefined ? { room: { roomTypeId } } : {}),
    ...(range ? {
      startDate: { lt: parseISODateOnly(range.endDate) },
      endDate: { gt: parseISODateOnly(range.startDate) },
    } : {}),
  };
}

/** Without a range, loads all active blocks so a form can change dates locally. */
export async function getActiveRoomBlocks(input: ActiveRoomBlocksInput = {}, db: RoomBlockReader = prisma): Promise<RoomBlockSummary[]> {
  const blocks = await db.roomBlock.findMany({
    where: activeRoomBlockWhere(input),
    select: { id: true, roomId: true, startDate: true, endDate: true, reason: true, status: true },
    orderBy: [{ startDate: "asc" }, { id: "asc" }],
  });
  return blocks.map((block) => ({ ...block, startDate: block.startDate.toISOString().slice(0, 10), endDate: block.endDate.toISOString().slice(0, 10) }));
}

export type RoomBlockReservationConflict = {
  id: number;
  reservationNo: string;
  arrivalDate: Date;
  departureDate: Date;
};

export async function detectRoomBlockReservationConflicts(
  input: { roomId: number; range: RoomBlockDateRange },
  db: RoomBlockReader = prisma,
): Promise<RoomBlockReservationConflict[]> {
  return db.reservation.findMany({
    where: {
      roomId: input.roomId,
      status: { in: ["CONFIRMED", "CHECKED_IN"] },
      arrivalDate: { lt: parseISODateOnly(input.range.endDate) },
      departureDate: { gt: parseISODateOnly(input.range.startDate) },
    },
    select: { id: true, reservationNo: true, arrivalDate: true, departureDate: true },
    orderBy: [{ arrivalDate: "asc" }, { id: "asc" }],
  });
}
