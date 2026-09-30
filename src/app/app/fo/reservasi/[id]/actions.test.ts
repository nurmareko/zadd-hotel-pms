import { Prisma, ReservationStatus, RoomStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), transaction: vi.fn(), queryRaw: vi.fn(),
  reservationFindUnique: vi.fn(), roomFindUnique: vi.fn(),
  logCreate: vi.fn(), roomUpdate: vi.fn(), revalidate: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction }, TRANSACTION_OPTIONS: {} }));
vi.mock("@/lib/check-in/actions", () => ({ getCheckInReviewData: vi.fn(), getFreshCheckInReview: vi.fn() }));
vi.mock("@/lib/reservation-inclusions/actions", () => ({ changeReservationMealPlan: vi.fn(), setReservationStayFee: vi.fn() }));
vi.mock("@/lib/revalidate-room-status", () => ({ revalidateRoomStatusViews: mocks.revalidate }));

import { requestRoomCleaning } from "./actions";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(async (operation) => operation({
    $queryRaw: mocks.queryRaw,
    reservation: { findUnique: mocks.reservationFindUnique },
    room: { findUnique: mocks.roomFindUnique, update: mocks.roomUpdate },
    housekeepingLog: { create: mocks.logCreate },
  }));
  mocks.reservationFindUnique.mockResolvedValue({ id: 1, roomId: 2, status: ReservationStatus.CHECKED_IN });
  mocks.roomFindUnique.mockResolvedValue({ id: 2, number: "102", status: RoomStatus.OC });
});

describe("requestRoomCleaning authorization", () => {
  it.each(["FO", "ADMIN", "GM"])("allows %s through the existing transaction", async (role) => {
    mocks.auth.mockResolvedValue({ user: { id: "7", role } });
    await expect(requestRoomCleaning(1)).resolves.toMatchObject({ ok: true });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
    expect(mocks.logCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ updatedById: 7, oldStatus: "OC", newStatus: "OD" }) });
    expect(mocks.roomUpdate).toHaveBeenCalledWith({ where: { id: 2 }, data: { status: "OD" } });
    expect(mocks.revalidate).toHaveBeenCalledWith({ reservationId: 1, roomId: 2 });
  });

  it.each([null, "HK", "FB", "ACC", "UNKNOWN"])("rejects %s before opening a transaction", async (role) => {
    mocks.auth.mockResolvedValue(role ? { user: { id: "7", role } } : null);
    await expect(requestRoomCleaning(1)).resolves.toEqual({ ok: false, error: "Anda tidak memiliki izin untuk melakukan tindakan ini." });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("still rejects a non-checked-in reservation for GM inside the transaction", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "7", role: "GM" } });
    mocks.reservationFindUnique.mockResolvedValue({ id: 1, roomId: 2, status: ReservationStatus.CONFIRMED });
    await expect(requestRoomCleaning(1)).resolves.toEqual({ ok: false, error: "Pembersihan kamar hanya bisa diminta untuk tamu yang sedang check-in." });
    expect(mocks.transaction).toHaveBeenCalled();
    expect(mocks.logCreate).not.toHaveBeenCalled();
    expect(mocks.roomUpdate).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
