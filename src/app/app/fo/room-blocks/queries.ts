import { prisma } from "@/lib/prisma";
import { blockFilterWhere, type BlockFilters } from "./filters";

// Management and export share this read; all mutations remain domain-owned.
export async function findRoomBlocks(filters: BlockFilters) {
  const blocks = await prisma.roomBlock.findMany({
    where: blockFilterWhere(filters),
    select: {
      id: true, roomId: true, startDate: true, endDate: true,
      reason: true, status: true, note: true,
      room: { select: { number: true, roomType: { select: { name: true } } } },
      createdBy: { select: { fullName: true } },
    },
    orderBy: [{ startDate: "desc" }, { id: "desc" }],
  });
  return blocks.map((block) => ({
    ...block,
    nights: Math.round((block.endDate.getTime() - block.startDate.getTime()) / 86_400_000),
    startDate: block.startDate.toISOString().slice(0, 10),
    endDate: block.endDate.toISOString().slice(0, 10),
  }));
}

export type RoomBlockRow = Awaited<ReturnType<typeof findRoomBlocks>>[number];
