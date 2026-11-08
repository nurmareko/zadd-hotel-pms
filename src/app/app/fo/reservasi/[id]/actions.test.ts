import { Prisma, ReservationStatus, RoomStatus } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), transaction: vi.fn(), queryRaw: vi.fn(),
  reservationFindUnique: vi.fn(), roomFindUnique: vi.fn(),
  logCreate: vi.fn(), roomUpdate: vi.fn(), revalidate: vi.fn(),
  reservationUpdateMany: vi.fn(), stayFeeUpdateMany: vi.fn(),
  logActivity: vi.fn(), revalidatePath: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction }, TRANSACTION_OPTIONS: {} }));
vi.mock("@/lib/check-in/actions", () => ({ getCheckInReviewData: vi.fn(), getFreshCheckInReview: vi.fn() }));
vi.mock("@/lib/reservation-inclusions/actions", () => ({ changeReservationMealPlan: vi.fn(), setReservationStayFee: vi.fn() }));
vi.mock("@/lib/revalidate-room-status", () => ({ revalidateRoomStatusViews: mocks.revalidate }));

vi.mock("@/lib/activity-log", () => ({ logActivity: mocks.logActivity }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { requestRoomCleaning } from "./actions";
import { markReservationNoShow } from "@/lib/reservations/actions";
import { reservationFailure } from "../new/reservation-errors";

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
    await expect(requestRoomCleaning(1)).resolves.toEqual({ ok: false, error: "You do not have permission to perform this action." });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("still rejects a non-checked-in reservation for GM inside the transaction", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "7", role: "GM" } });
    mocks.reservationFindUnique.mockResolvedValue({ id: 1, roomId: 2, status: ReservationStatus.CONFIRMED });
    await expect(requestRoomCleaning(1)).resolves.toEqual({ ok: false, error: "Room cleaning can only be requested for in-house guests." });
    expect(mocks.transaction).toHaveBeenCalled();
    expect(mocks.logCreate).not.toHaveBeenCalled();
    expect(mocks.roomUpdate).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});

describe("markReservationNoShow", () => {
  const confirmedReservation = () => ({
    id: 1,
    roomId: 2,
    status: ReservationStatus.CONFIRMED,
    arrivalDate: new Date("2026-06-01T00:00:00.000Z"),
    folio: null,
  });

  const tx = {
    reservation: {
      findUnique: mocks.reservationFindUnique,
      updateMany: mocks.reservationUpdateMany,
    },
    reservationStayFee: { updateMany: mocks.stayFeeUpdateMany },
  };

  function expectNoPostCommitEffects() {
    expect(mocks.logActivity).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  }

  function expectNoWrites() {
    expect(mocks.reservationUpdateMany).not.toHaveBeenCalled();
    expect(mocks.stayFeeUpdateMany).not.toHaveBeenCalled();
    expectNoPostCommitEffects();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    // June 1, 00:40 in Jakarta, while the UTC/server date is still May 31.
    vi.setSystemTime(new Date("2026-05-31T17:40:00.000Z"));
    mocks.auth.mockResolvedValue({ user: { id: "7", role: "FO" } });
    mocks.reservationFindUnique.mockResolvedValue(confirmedReservation());
    mocks.reservationUpdateMany.mockResolvedValue({ count: 1 });
    mocks.stayFeeUpdateMany.mockResolvedValue({ count: 2 });
    mocks.transaction.mockImplementation(async (operation) => operation(tx));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(["FO", "ADMIN", "GM"])("allows %s to mark a reservation on its hotel-local arrival day", async (role) => {
    mocks.auth.mockResolvedValue({ user: { id: "7", role } });

    await expect(markReservationNoShow(1)).resolves.toEqual({ ok: true });

    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }));
    expect(mocks.reservationFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1 } }));
    expect(mocks.reservationUpdateMany).toHaveBeenCalledExactlyOnceWith({
      where: { id: 1, status: ReservationStatus.CONFIRMED },
      data: { status: ReservationStatus.NO_SHOW, roomId: null },
    });
  });

  it("allows a past arrival date", async () => {
    mocks.reservationFindUnique.mockResolvedValue({
      ...confirmedReservation(), arrivalDate: new Date("2026-05-30T00:00:00.000Z"),
    });
    await expect(markReservationNoShow(1)).resolves.toEqual({ ok: true });
  });

  it("allows an existing deposit folio without touching the folio or its payments", async () => {
    const folio = { id: 10, payments: [{ id: 20, amount: "500000" }] };
    const reservation = { ...confirmedReservation(), folio, depositStatus: "COLLECTED" };
    const original = structuredClone(reservation);
    mocks.reservationFindUnique.mockResolvedValue(reservation);
    const folioUpdate = vi.fn();
    const folioDelete = vi.fn();
    const paymentUpdate = vi.fn();
    const paymentDelete = vi.fn();
    mocks.transaction.mockImplementation(async (operation) => operation({
      ...tx,
      folio: { update: folioUpdate, updateMany: folioUpdate, delete: folioDelete, deleteMany: folioDelete },
      payment: { update: paymentUpdate, updateMany: paymentUpdate, delete: paymentDelete, deleteMany: paymentDelete },
    }));

    await expect(markReservationNoShow(1)).resolves.toEqual({ ok: true });

    expect(reservation).toEqual(original);
    for (const write of [folioUpdate, folioDelete, paymentUpdate, paymentDelete]) {
      expect(write).not.toHaveBeenCalled();
    }
    expect(mocks.reservationUpdateMany).toHaveBeenCalledWith({
      where: { id: 1, status: ReservationStatus.CONFIRMED },
      data: { status: ReservationStatus.NO_SHOW, roomId: null },
    });
  });

  it("cancels only unposted pending stay fees inside the same transaction", async () => {
    let insideTransaction = false;
    mocks.transaction.mockImplementation(async (operation) => {
      insideTransaction = true;
      try {
        return await operation(tx);
      } finally {
        insideTransaction = false;
      }
    });
    mocks.stayFeeUpdateMany.mockImplementation(async () => {
      expect(insideTransaction).toBe(true);
      expect(mocks.reservationUpdateMany).toHaveBeenCalledTimes(1);
      expectNoPostCommitEffects();
      return { count: 2 };
    });

    await expect(markReservationNoShow(1)).resolves.toEqual({ ok: true });

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.stayFeeUpdateMany).toHaveBeenCalledExactlyOnceWith({
      where: { reservationId: 1, status: "PENDING", folioLineItemId: null },
      data: { status: "CANCELLED" },
    });
  });

  it("logs no-show metadata and revalidates reservation views after commit", async () => {
    mocks.transaction.mockImplementation(async (operation) => {
      const result = await operation(tx);
      expectNoPostCommitEffects();
      return result;
    });

    await expect(markReservationNoShow(1)).resolves.toEqual({ ok: true });

    expect(mocks.logActivity).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      userId: 7,
      action: "RESERVATION_UPDATED",
      reservationId: 1,
      metadata: expect.objectContaining({ event: "NO_SHOW", previousStatus: "CONFIRMED" }),
    }));
    for (const path of ["/app/fo/reservasi/list", "/app/fo/reservasi/1", "/app/fo/reservasi/kalender"]) {
      expect(mocks.revalidatePath).toHaveBeenCalledWith(path);
    }
  });

  it("rejects a future arrival with the precise operator message", async () => {
    mocks.reservationFindUnique.mockResolvedValue({
      ...confirmedReservation(), arrivalDate: new Date("2026-06-02T00:00:00.000Z"),
    });
    await expect(markReservationNoShow(1)).resolves.toMatchObject({
      ok: false,
      error: "Reservation cannot be marked as no-show before the scheduled arrival date.",
    });
    expectNoWrites();
  });

  it.each([ReservationStatus.CHECKED_IN, ReservationStatus.CHECKED_OUT, ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW])("rejects status %s", async (status) => {
    mocks.reservationFindUnique.mockResolvedValue({ ...confirmedReservation(), status });
    await expect(markReservationNoShow(1)).resolves.toMatchObject({ ok: false, error: expect.any(String) });
    expectNoWrites();
  });

  it.each([null, "HK", "FB", "ACC", "UNKNOWN"])("rejects unauthorized role %s before a transaction", async (role) => {
    mocks.auth.mockResolvedValue(role ? { user: { id: "7", role } } : null);
    await expect(markReservationNoShow(1)).resolves.toEqual(reservationFailure(role ? "FORBIDDEN" : "SESSION_EXPIRED"));
    expect(mocks.transaction).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it.each([0, -1, 1.5, NaN, Infinity])("rejects invalid reservation ID %s before a transaction", async (id) => {
    await expect(markReservationNoShow(id)).resolves.toEqual(reservationFailure("INVALID_RESERVATION_DATA"));
    expect(mocks.transaction).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it("rejects a missing reservation", async () => {
    mocks.reservationFindUnique.mockResolvedValue(null);
    await expect(markReservationNoShow(1)).resolves.toEqual(reservationFailure("RESERVATION_NOT_FOUND"));
    expectNoWrites();
  });

  it("returns a conflict when the conditional update affects no reservation", async () => {
    mocks.reservationUpdateMany.mockResolvedValue({ count: 0 });
    await expect(markReservationNoShow(1)).resolves.toEqual(reservationFailure("RESERVATION_CONFLICT"));
    expect(mocks.stayFeeUpdateMany).not.toHaveBeenCalled();
    expectNoPostCommitEffects();
  });

  it.each(["P2034", "P2028"])("returns a conflict for transaction error %s", async (code) => {
    mocks.transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("Transaction conflict", {
      code, clientVersion: "6.0.0",
    }));
    await expect(markReservationNoShow(1)).resolves.toEqual(reservationFailure("RESERVATION_CONFLICT"));
    expectNoWrites();
  });
});
