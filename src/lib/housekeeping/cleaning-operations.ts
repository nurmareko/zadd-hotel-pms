import { HousekeepingNotificationStatus, Prisma, RoomStatus } from "@prisma/client";

import { hotelTodayDateOnly } from "@/lib/date-only";
import { isMobilePoolEligible } from "@/lib/housekeeper-mobile-eligibility";
import { upsertHousekeepingNotification } from "@/lib/housekeeping-notifications";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";

export type CleaningResult = { ok: true } | { ok: false; error: string };
export type CleaningOperator = { userId: number; role: "HK" | "ADMIN" };
type RoomInput = CleaningOperator & { roomId: number };
export type FinishCleaningInput = RoomInput & {
  linenChanged: boolean;
  towelChanged: boolean;
  note?: string | null;
};
export type InspectRoomInput = RoomInput & { passed: boolean; notes?: string | null };

class CleaningError extends Error {}
const conflictMessage = "Kamar sedang diproses. Muat ulang halaman.";

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
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2034" && attempt < 2) continue;
        if (error.code === "P2034" || error.code === "P2028") {
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
      (operator.role !== "HK" && operator.role !== "ADMIN")) {
    throw new CleaningError("Tidak berwenang");
  }
  const user = await tx.user.findFirst({
    where: {
      id: operator.userId,
      isActive: true,
      roles: { some: { role: { code: operator.role } } },
    },
    select: { id: true },
  });
  if (!user) throw new CleaningError("Tidak berwenang");
}

async function lockRoom(tx: Prisma.TransactionClient, roomId: number) {
  if (!Number.isSafeInteger(roomId) || roomId <= 0 || roomId > 2147483647) {
    throw new CleaningError("Kamar tidak valid");
  }
  await tx.$queryRaw`SELECT id FROM "room" WHERE id = ${roomId} FOR UPDATE`;
  // One clock sample after acquiring the lock, including on each retry.
  const now = new Date();
  const today = hotelTodayDateOnly(now);
  const room = await tx.room.findUnique({ where: { id: roomId }, select: { status: true } });
  if (!room) throw new CleaningError("Kamar tidak ditemukan");
  return { room, now, today };
}

async function ownAssignment(tx: Prisma.TransactionClient, input: RoomInput, today: Date) {
  const assignment = await tx.housekeepingAssignment.findFirst({
    where: { roomId: input.roomId, date: today, housekeeperId: input.userId },
    select: { id: true },
  });
  if (!assignment) throw new CleaningError("Kamar ini bukan tugas Anda");
  return assignment;
}

async function requireNoActiveSession(tx: Prisma.TransactionClient, roomId: number) {
  const active = await tx.cleaningSession.findFirst({
    where: { roomId, startedAt: { not: null }, finishedAt: null },
    select: { id: true },
  });
  if (active) throw new CleaningError("Pembersihan kamar ini sudah berjalan");
}

export async function startCleaningOperation(input: RoomInput): Promise<CleaningResult> {
  return runTransaction("Gagal memulai pembersihan", async (tx) => {
    const { room, now, today } = await lockRoom(tx, input.roomId);
    await requireOperator(tx, input);
    const assignment = await ownAssignment(tx, input, today);
    if (room.status !== RoomStatus.VD && room.status !== RoomStatus.OD) {
      throw new CleaningError("Kamar ini tidak berada dalam antrean pembersihan");
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
  return runTransaction("Gagal menyelesaikan pembersihan", async (tx) => {
    const { room, now, today } = await lockRoom(tx, input.roomId);
    await requireOperator(tx, input);
    const assignment = await ownAssignment(tx, input, today);
    if (room.status !== RoomStatus.VD && room.status !== RoomStatus.OD) {
      throw new CleaningError("Status kamar berubah. Muat ulang halaman.");
    }
    if (room.status === RoomStatus.VD && (!input.linenChanged || !input.towelChanged)) {
      throw new CleaningError("Untuk kamar kosong setelah check-out, linen dan handuk wajib diganti.");
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
    if (!session) throw new CleaningError("Tidak ada sesi pembersihan aktif");
    const nextStatus = room.status === RoomStatus.OD ? RoomStatus.OC : RoomStatus.VCU;
    requireOne(await tx.cleaningSession.updateMany({
      where: { id: session.id, ...sessionWhere },
      data: { finishedAt: now },
    }));
    requireOne(await tx.room.updateMany({
      where: { id: input.roomId, status: room.status },
      data: { status: nextStatus },
    }));
    await tx.housekeepingLog.create({
      data: {
        roomId: input.roomId, oldStatus: room.status, newStatus: nextStatus,
        updatedById: input.userId, updatedAt: now,
        note: input.note || "Pembersihan selesai dari daftar kerja petugas HK",
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
  return runTransaction("Gagal menyimpan hasil inspeksi", async (tx) => {
    const { room, now } = await lockRoom(tx, input.roomId);
    await requireOperator(tx, input);
    if (!input.passed && !input.notes?.trim()) {
      throw new CleaningError("Alasan kegagalan inspeksi wajib diisi");
    }
    if (room.status !== RoomStatus.VCU) throw new CleaningError("Kamar ini tidak menunggu inspeksi");
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
  return runTransaction("Gagal mengambil tugas kamar", async (tx) => {
    const { room, today } = await lockRoom(tx, input.roomId);
    await requireOperator(tx, input);
    const assignment = await tx.housekeepingAssignment.findUnique({
      where: { roomId_date: { roomId: input.roomId, date: today } },
      select: { id: true, housekeeperId: true },
    });
    if (assignment) {
      if (assignment.housekeeperId === input.userId) return;
      throw new CleaningError("Kamar sudah ditugaskan ke petugas lain. Daftar diperbarui.");
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
      throw new CleaningError("Kamar ini tidak tersedia untuk diambil");
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
  return runTransaction("Gagal mencatat barang temuan", async (tx) => {
    if (input.roomId !== null) await lockRoom(tx, input.roomId);
    await requireOperator(tx, input);
    const description = input.description.trim();
    if (description.length < 3 || description.length > 500) {
      throw new CleaningError("Deskripsi harus terdiri dari 3–500 karakter");
    }
    await tx.lostFoundItem.create({
      data: { roomId: input.roomId, description, foundById: input.userId },
    });
  });
}
