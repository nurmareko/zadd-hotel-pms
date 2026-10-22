import { HousekeepingNotificationStatus, Prisma, RoomStatus } from "@prisma/client";

import { hotelTodayDateOnly } from "@/lib/date-only";
import { AMENITIES_ITEMS, AMENITY_INGREDIENT_MAP, type AmenityKey } from "@/lib/housekeeping/amenities";
import { isMobilePoolEligible } from "@/lib/housekeeper-mobile-eligibility";
import { upsertHousekeepingNotification } from "@/lib/housekeeping-notifications";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { allocateLostFoundReference, isLostFoundReferenceConflict } from "@/lib/lost-found/reference-allocation";

export type CleaningResult = { ok: true } | { ok: false; error: string };
export type CleaningOperator = { userId: number; role: "HK" | "ADMIN" | "GM" };
type RoomInput = CleaningOperator & { roomId: number };
export type FinishCleaningInput = RoomInput & {
  linenChanged: boolean;
  towelChanged: boolean;
  note?: string | null;
  amenities?: Partial<Record<AmenityKey, number>> | null;
};
export type InspectRoomInput = RoomInput & { passed: boolean; notes?: string | null };

class CleaningError extends Error {}
const conflictMessage = "The room is being processed. Reload the page.";

function requireOne(result: { count: number }) {
  // Throw after any failed conditional write so earlier writes cannot commit.
  if (result.count !== 1) throw new CleaningError(conflictMessage);
}

async function runTransaction(
  fallback: string,
  operation: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<CleaningResult> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await prisma.$transaction(operation, {
        ...TRANSACTION_OPTIONS,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
      return { ok: true };
    } catch (error) {
      if (error instanceof CleaningError) return { ok: false, error: error.message };
      if (isLostFoundReferenceConflict(error)) {
        if (attempt < 2) continue;
        return { ok: false, error: conflictMessage };
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        const retryable = error.code === "P2034" ||
          (error.code === "P2010" && ["40001", "40P01"].includes(String(error.meta?.code)));
        if (retryable && attempt < 2) continue;
        if (retryable || error.code === "P2028") {
          return { ok: false, error: conflictMessage };
        }
      }
      return { ok: false, error: fallback };
    }
  }
  return { ok: false, error: conflictMessage };
}

async function requireOperator(tx: Prisma.TransactionClient, operator: CleaningOperator) {
  if (!Number.isSafeInteger(operator.userId) || operator.userId <= 0 || operator.userId > 2147483647 ||
      (operator.role !== "HK" && operator.role !== "ADMIN" && operator.role !== "GM")) {
    throw new CleaningError("Not authorized");
  }
  const user = await tx.user.findFirst({
    where: {
      id: operator.userId,
      isActive: true,
      roles: { some: { role: { code: operator.role } } },
    },
    select: { id: true },
  });
  if (!user) throw new CleaningError("Not authorized");
}

async function lockRoom(tx: Prisma.TransactionClient, roomId: number) {
  if (!Number.isSafeInteger(roomId) || roomId <= 0 || roomId > 2147483647) {
    throw new CleaningError("Invalid room");
  }
  await tx.$queryRaw`SELECT id FROM "room" WHERE id = ${roomId} FOR UPDATE`;
  // One clock sample after acquiring the lock, including on each retry.
  const now = new Date();
  const today = hotelTodayDateOnly(now);
  const room = await tx.room.findUnique({ where: { id: roomId }, select: { status: true, number: true } });
  if (!room) throw new CleaningError("Room not found");
  return { room, now, today };
}

async function ownAssignment(tx: Prisma.TransactionClient, input: RoomInput, today: Date) {
  const assignment = await tx.housekeepingAssignment.findFirst({
    where: { roomId: input.roomId, date: today, housekeeperId: input.userId },
    select: { id: true },
  });
  if (!assignment) throw new CleaningError("This room is not assigned to you");
  return assignment;
}

async function requireNoActiveSession(tx: Prisma.TransactionClient, roomId: number) {
  const active = await tx.cleaningSession.findFirst({
    where: { roomId, startedAt: { not: null }, finishedAt: null },
    select: { id: true },
  });
  if (active) throw new CleaningError("Cleaning is already in progress for this room");
}

export async function startCleaningOperation(input: RoomInput): Promise<CleaningResult> {
  return runTransaction("Failed to start cleaning", async (tx) => {
    const { room, now, today } = await lockRoom(tx, input.roomId);
    await requireOperator(tx, input);
    const assignment = await ownAssignment(tx, input, today);
    if (room.status !== RoomStatus.VD && room.status !== RoomStatus.OD) {
      throw new CleaningError("This room is not in the cleaning queue");
    }
    await requireNoActiveSession(tx, input.roomId);
    await tx.cleaningSession.create({
      data: { roomId: input.roomId, housekeeperId: input.userId, date: today, startedAt: now },
    });
    await upsertHousekeepingNotification(tx, {
      assignmentId: assignment.id,
      recipientId: input.userId,
      status: HousekeepingNotificationStatus.IN_PROGRESS,
    });
  });
}

export async function finishCleaningOperation(input: FinishCleaningInput): Promise<CleaningResult> {
  return runTransaction("Failed to complete cleaning", async (tx) => {
    const { room, now, today } = await lockRoom(tx, input.roomId);
    await requireOperator(tx, input);
    const assignment = await ownAssignment(tx, input, today);
    if (room.status !== RoomStatus.VD && room.status !== RoomStatus.OD) {
      throw new CleaningError("Room status changed. Reload the page.");
    }
    if (room.status === RoomStatus.VD && (!input.linenChanged || !input.towelChanged)) {
      throw new CleaningError("Linen and towels must be replaced in vacant rooms after check-out.");
    }
    // A session may cross WIB midnight; today's assignment must still be ours.
    const sessionWhere = {
      roomId: input.roomId,
      housekeeperId: input.userId,
      startedAt: { not: null },
      finishedAt: null,
    };
    const session = await tx.cleaningSession.findFirst({
      where: sessionWhere,
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!session) throw new CleaningError("There is no active cleaning session");
    const nextStatus = room.status === RoomStatus.OD ? RoomStatus.OC : RoomStatus.VCU;
    requireOne(await tx.cleaningSession.updateMany({
      where: { id: session.id, ...sessionWhere },
      data: { finishedAt: now },
    }));
    requireOne(await tx.room.updateMany({
      where: { id: input.roomId, status: room.status },
      data: { status: nextStatus },
    }));
    const quantities = new Map<string, number>();
    for (const { key } of AMENITIES_ITEMS) {
      const quantity = input.amenities?.[key];
      if (typeof quantity === "number" && Number.isSafeInteger(quantity) && quantity > 0) {
        quantities.set(AMENITY_INGREDIENT_MAP[key].name, quantity);
      }
    }
    if (quantities.size > 0) {
      const ingredients = await tx.fBIngredient.findMany({
        where: { name: { in: [...quantities.keys()] }, category: "Amenities" },
        orderBy: { id: "asc" },
      });
      for (const ingredient of ingredients) {
        const quantity = quantities.get(ingredient.name);
        if (quantity === undefined) continue;
        // All turnover writers acquire shared ingredient locks in ascending ID order.
        await tx.$queryRaw`SELECT id FROM "fb_ingredient" WHERE id = ${ingredient.id} FOR UPDATE`;
        const current = await tx.fBIngredient.findUnique({ where: { id: ingredient.id } });
        if (!current || current.category !== "Amenities" || current.name !== ingredient.name) continue;
        const balanceAfter = current.onHand.minus(quantity);
        await tx.fBIngredient.update({ where: { id: current.id }, data: { onHand: balanceAfter } });
        await tx.fBStockLedger.create({
          data: {
            ingredientId: current.id,
            type: "CONSUMPTION",
            quantityDelta: new Prisma.Decimal(-quantity),
            balanceAfter,
            notes: `Room turnover - Room ${room.number}`,
            recordedById: input.userId,
            createdAt: now,
          },
        });
        // Names are not unique in the schema; consume each requested item only once.
        quantities.delete(ingredient.name);
      }
      for (const name of quantities.keys()) {
        console.warn("Missing amenity ingredient during room turnover", { roomId: input.roomId, name });
      }
    }
    await tx.housekeepingLog.create({
      data: {
        roomId: input.roomId, oldStatus: room.status, newStatus: nextStatus,
        updatedById: input.userId, updatedAt: now,
        note: input.note || "Cleaning completed from the HK staff task list",
        linenChanged: input.linenChanged, towelChanged: input.towelChanged,
      },
    });
    await upsertHousekeepingNotification(tx, {
      assignmentId: assignment.id, recipientId: input.userId,
      status: HousekeepingNotificationStatus.COMPLETED,
    });
  });
}

export async function inspectRoomOperation(input: InspectRoomInput): Promise<CleaningResult> {
  return runTransaction("Failed to save the inspection result", async (tx) => {
    const { room, now } = await lockRoom(tx, input.roomId);
    await requireOperator(tx, input);
    if (!input.passed && !input.notes?.trim()) {
      throw new CleaningError("A reason for the failed inspection is required");
    }
    if (room.status !== RoomStatus.VCU) throw new CleaningError("This room is not awaiting inspection");
    await requireNoActiveSession(tx, input.roomId);
    const session = await tx.cleaningSession.findFirst({
      where: { roomId: input.roomId, finishedAt: { not: null }, inspectedAt: null },
      orderBy: [{ finishedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });
    // Manually overridden VCU rooms may not have a completed cleaning session.
    if (session) {
      requireOne(await tx.cleaningSession.updateMany({
        where: { id: session.id, roomId: input.roomId, finishedAt: { not: null }, inspectedAt: null },
        data: { inspectedAt: now, inspectedById: input.userId },
      }));
    }
    const nextStatus = input.passed ? RoomStatus.VC : RoomStatus.VD;
    requireOne(await tx.room.updateMany({
      where: { id: input.roomId, status: RoomStatus.VCU }, data: { status: nextStatus },
    }));
    await tx.housekeepingLog.create({
      data: {
        roomId: input.roomId, oldStatus: room.status, newStatus: nextStatus,
        updatedById: input.userId, updatedAt: now, note: input.notes?.trim() || null,
      },
    });
  });
}

export async function claimAvailableRoomOperation(input: RoomInput): Promise<CleaningResult> {
  return runTransaction("Failed to claim the room task", async (tx) => {
    const { room, today } = await lockRoom(tx, input.roomId);
    await requireOperator(tx, input);
    const assignment = await tx.housekeepingAssignment.findUnique({
      where: { roomId_date: { roomId: input.roomId, date: today } },
      select: { id: true, housekeeperId: true },
    });
    if (assignment) {
      if (assignment.housekeeperId === input.userId) return;
      throw new CleaningError("The room is already assigned to another staff member. The list has been refreshed.");
    }
    await requireNoActiveSession(tx, input.roomId);
    const movement = await tx.reservation.findFirst({
      where: {
        roomId: input.roomId,
        OR: [
          { status: "CONFIRMED", arrivalDate: today },
          { status: { in: ["CHECKED_IN", "CHECKED_OUT"] }, departureDate: today },
        ],
      },
      select: { id: true },
    });
    if (!isMobilePoolEligible({ status: room.status, hasScheduledMovement: Boolean(movement) })) {
      throw new CleaningError("This room is unavailable to claim");
    }
    const created = await tx.housekeepingAssignment.create({
      data: { roomId: input.roomId, date: today, housekeeperId: input.userId },
      select: { id: true },
    });
    await upsertHousekeepingNotification(tx, {
      assignmentId: created.id, recipientId: input.userId,
      status: HousekeepingNotificationStatus.ASSIGNED,
    });
  });
}

export async function reportFloorLostFoundOperation(
  input: CleaningOperator & { roomId: number | null; description: string },
): Promise<CleaningResult> {
  return runTransaction("Failed to record the found item", async (tx) => {
    if (input.roomId !== null) await lockRoom(tx, input.roomId);
    await requireOperator(tx, input);
    const description = input.description.trim();
    if (description.length < 3 || description.length > 500) {
      throw new CleaningError("Description must be 3–500 characters");
    }
    const allocation = await allocateLostFoundReference(tx);
    await tx.lostFoundItem.create({
      data: { ...allocation, roomId: input.roomId, description, foundById: input.userId, category: "OTHER" },
    });
  });
}
