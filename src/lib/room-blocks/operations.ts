import { Prisma, RoomStatus } from "@prisma/client";
import { allowedRoomStatuses } from "@/app/app/hk/room-status-options";
import { addDateOnlyDays, hotelTodayDateOnly, parseISODateOnly, todayDateOnly } from "@/lib/date-only";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { validateRoomTypeCapacity } from "@/lib/reservation-capacity";
import { RoomBlockError } from "./errors";
import { activeRoomBlockWhere, detectRoomBlockReservationConflicts } from "./queries";
import type { CreateRoomBlockValues } from "./schema";

async function retryTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        ...TRANSACTION_OPTIONS,
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || !["P2034", "P2028"].includes(error.code)) throw error;
      if (attempt === 2) throw new RoomBlockError("CONCURRENT_CHANGE", "Room data was changed concurrently. Reload the page and try again.");
    }
  }
}

/** Internal typed operation; owns the whole transition, including retries and capacity rechecks. */
export async function createRoomBlock(input: CreateRoomBlockValues, operatorId: number) {
  return retryTransaction((tx) => createRoomBlockInTransaction(tx, input, operatorId));
}

// Private to this module: callers can only invoke complete, transaction-owning operations.
async function createRoomBlockInTransaction(
  tx: Prisma.TransactionClient,
  input: CreateRoomBlockValues,
  operatorId: number,
  now = new Date(),
) {
  // Same lock order as reservation writers: physical room, then room-type capacity.
  await tx.$queryRaw`SELECT id FROM "room" WHERE id = ${input.roomId} FOR UPDATE`;
  const room = await tx.room.findUnique({ where: { id: input.roomId } });
  if (!room) throw new RoomBlockError("ROOM_NOT_FOUND", "Room not found.");
  const conflicts = await detectRoomBlockReservationConflicts({ roomId: room.id, range: input }, tx);
  if (conflicts.length) {
    throw new RoomBlockError("RESERVATION_CONFLICT", `Room ${room.number} has an active reservation ${conflicts[0].reservationNo} overlapping the block period. Change the room or block dates.`);
  }
  const startDate = parseISODateOnly(input.startDate);
  const endDate = parseISODateOnly(input.endDate);
  const block = await tx.roomBlock.create({ data: {
    roomId: room.id, startDate, endDate, reason: input.reason,
    note: input.note || null, createdById: operatorId,
  } });
  // Include this block in the authoritative per-day check. Throw rolls it back.
  const capacity = await validateRoomTypeCapacity({ roomTypeId: room.roomTypeId, arrival: startDate, departure: endDate, requestedCount: 0 }, tx);
  if (!capacity.ok) throw new RoomBlockError("CAPACITY_CONFLICT", `The block cannot be created. ${capacity.error}`);
  const today = hotelTodayDateOnly(now);
  if (startDate <= today && endDate > today && room.status !== "OOO") {
    const activeCleaningSession = await tx.cleaningSession.findFirst({
      where: { roomId: room.id, startedAt: { not: null }, finishedAt: null },
      select: { id: true },
    });
    if (activeCleaningSession) {
      throw new RoomBlockError(
        "CLEANING_IN_PROGRESS",
        "Room cleaning is in progress. Complete it from the housekeeper task list first.",
      );
    }
    // Departure dates free inventory, but only checkout ends physical occupancy.
    const occupant = await tx.reservation.findFirst({
      where: { roomId: room.id, status: "CHECKED_IN" },
      select: { id: true },
    });
    if (occupant) {
      throw new RoomBlockError(
        "ROOM_OCCUPIED",
        "The room is still occupied by a guest who has not checked out. Complete check-out before changing the room status.",
      );
    }
    const updated = await tx.room.updateMany({ where: { id: room.id, status: room.status }, data: { status: "OOO" } });
    if (updated.count !== 1) throw new RoomBlockError("CONCURRENT_CHANGE", "Room status changed. Reload the page and try again.");
    await tx.housekeepingLog.create({ data: { roomId: room.id, oldStatus: room.status, newStatus: "OOO", updatedById: operatorId, note: `Room block #${block.id} started.` } });
  }
  return { ok: true as const, blockId: block.id, roomId: room.id };
}

/** Owns the HK status, current block lifecycle, and audit log as one atomic transition. */
export async function setHousekeepingRoomStatus(
  input: { roomId: number; status: RoomStatus; source: "board" | "override" },
  operatorId: number,
) {
  return retryTransaction(async (tx) => {
    const { roomId, status, source } = input;
    await tx.$queryRaw`SELECT id FROM "room" WHERE id = ${roomId} FOR UPDATE`;
    const room = await tx.room.findUnique({ where: { id: roomId } });
    if (!room) throw new RoomBlockError("ROOM_NOT_FOUND", "Room not found");
    if (room.status === status) return { ok: true as const };

    const [occupant, cleaningSession] = await Promise.all([
      tx.reservation.findFirst({ where: { roomId, status: "CHECKED_IN" }, select: { id: true } }),
      tx.cleaningSession.findFirst({
        where: { roomId, startedAt: { not: null }, finishedAt: null },
        select: { id: true },
      }),
    ]);
    if (source === "board" && !allowedRoomStatuses(Boolean(occupant)).includes(status)) {
      throw new RoomBlockError("INVALID_INPUT", occupant
        ? "A room with a checked-in guest can only use status OC, OD, or OOO."
        : "A room without a checked-in guest can only use status VC, VD, VCU, or OOO.");
    }
    if (cleaningSession) {
      throw new RoomBlockError("CLEANING_IN_PROGRESS", "Room cleaning is in progress. Complete it from the HK staff task list first.");
    }
    if (occupant && (room.status === "OOO" || status === "OOO")) {
      throw new RoomBlockError("ROOM_OCCUPIED", "The room is still occupied by a guest who has not checked out. Complete check-out before changing the room status.");
    }

    const now = new Date();
    const today = hotelTodayDateOnly(now);
    const tomorrow = addDateOnlyDays(today, 1);
    if (status === "OOO") {
      await createRoomBlockInTransaction(tx, {
        roomId,
        startDate: today.toISOString().slice(0, 10),
        endDate: tomorrow.toISOString().slice(0, 10),
        reason: "MAINTENANCE",
        note: "Manual OOO block from Housekeeping",
      }, operatorId, now);
      return { ok: true as const };
    }

    if (room.status === "OOO") {
      // Release all covering blocks together; future and expired blocks are untouched.
      const blocks = await tx.roomBlock.findMany({
        where: { roomId, status: "ACTIVE", startDate: { lte: today }, endDate: { gt: today } },
        select: { id: true },
      });
      if (blocks.length) {
        const released = await tx.roomBlock.updateMany({
          where: { id: { in: blocks.map((block) => block.id) }, roomId, status: "ACTIVE" },
          data: { status: "RELEASED" },
        });
        if (released.count !== blocks.length) {
          throw new RoomBlockError("CONCURRENT_CHANGE", "Room blocks were changed concurrently. Reload the page and try again.");
        }
      }
    }

    const updated = await tx.room.updateMany({
      where: { id: roomId, status: room.status }, data: { status },
    });
    if (updated.count !== 1) throw new RoomBlockError("CONCURRENT_CHANGE", "Room status changed. Reload the page and try again.");
    await tx.housekeepingLog.create({ data: {
      roomId, oldStatus: room.status, newStatus: status, updatedById: operatorId, updatedAt: now,
      note: source === "board"
        ? "Manual status change from the HK room board"
        : "Manual status change by HK staff or ADMIN",
    } });
    return { ok: true as const };
  });
}

export async function releaseRoomBlock(blockId: number, operatorId: number) {
  return retryTransaction(async (tx) => {
    // The first read only locates the room lock; block state is re-read afterwards.
    const locator = await tx.roomBlock.findUnique({ where: { id: blockId }, select: { roomId: true } });
    if (!locator) throw new RoomBlockError("BLOCK_NOT_FOUND", "Room block not found.");
    await tx.$queryRaw`SELECT id FROM "room" WHERE id = ${locator.roomId} FOR UPDATE`;
    const room = await tx.room.findUnique({ where: { id: locator.roomId } });
    const block = await tx.roomBlock.findUnique({ where: { id: blockId } });
    if (!room) throw new RoomBlockError("ROOM_NOT_FOUND", "Room not found.");
    if (!block || block.roomId !== room.id) throw new RoomBlockError("BLOCK_NOT_FOUND", "Room block not found. Reload the page.");
    if (block.status === "RELEASED") return { ok: true as const, blockId, roomId: room.id, alreadyReleased: true };
    const released = await tx.roomBlock.updateMany({ where: { id: blockId, roomId: room.id, status: "ACTIVE" }, data: { status: "RELEASED" } });
    if (released.count !== 1) throw new RoomBlockError("CONCURRENT_CHANGE", "Room blocks were changed concurrently. Reload the page and try again.");
    const { today, tomorrow } = todayDateOnly();
    const remaining = await tx.roomBlock.findFirst({ where: activeRoomBlockWhere({ roomId: room.id, range: { startDate: today.toISOString().slice(0, 10), endDate: tomorrow.toISOString().slice(0, 10) } }), select: { id: true } });
    // A future block has not begun its lifecycle and cannot clear current OOO.
    // Already-started blocks include expired ones awaiting explicit release.
    if (room.status === "OOO" && block.startDate <= today && !remaining) {
      const occupant = await tx.reservation.findFirst({
        where: { roomId: room.id, status: "CHECKED_IN" },
        select: { id: true },
      });
      if (occupant) {
        throw new RoomBlockError(
          "ROOM_OCCUPIED",
          "The room is still occupied by a guest who has not checked out. Complete check-out before changing the room status.",
        );
      }
      const updated = await tx.room.updateMany({ where: { id: room.id, status: "OOO" }, data: { status: "VD" } });
      if (updated.count !== 1) throw new RoomBlockError("CONCURRENT_CHANGE", "Room status changed. Reload the page and try again.");
      await tx.housekeepingLog.create({ data: { roomId: room.id, oldStatus: "OOO", newStatus: "VD", updatedById: operatorId, note: `Room block #${blockId} released. The room needs cleaning.` } });
    }
    return { ok: true as const, blockId, roomId: room.id, alreadyReleased: false };
  });
}
