import {
  ArrangementType,
  DepositStatus,
  GuestIdType,
  PaymentMethod,
  Prisma,
  ReservationStatus,
  ReservationType,
  RoomStatus,
} from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  logActivity: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  postPendingReservationStayFees: vi.fn(),
  reservationFindUnique: vi.fn(),
  reservationFindFirst: vi.fn(),
  roomFindUnique: vi.fn(),
  roomBlockFindMany: vi.fn(),
  folioCount: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/activity-log", () => ({ logActivity: mocks.logActivity }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    reservation: {
      findUnique: mocks.reservationFindUnique,
      findFirst: mocks.reservationFindFirst,
    },
    room: {
      findUnique: mocks.roomFindUnique,
    },
    roomBlock: { findMany: mocks.roomBlockFindMany },
    folio: {
      count: mocks.folioCount,
    },
    $transaction: mocks.transaction,
  },
  TRANSACTION_OPTIONS: {},
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return { ...actual, redirect: mocks.redirect };
});
vi.mock("@/lib/reservation-stay-fees", () => {
  class ReservationStayFeeError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ReservationStayFeeError";
    }
  }
  return {
    ReservationStayFeeError,
    postPendingReservationStayFees: mocks.postPendingReservationStayFees,
  };
});

import { ReservationStayFeeError } from "@/lib/reservation-stay-fees";
import {
  collectAdvanceReservationDeposit,
  collectCheckInDeposit,
  collectCheckInDepositForGroup,
  completeCheckIn,
  getCheckInReviewData,
  getFreshCheckInReview,
} from "./actions";
import { CHECK_IN_FAILURE_MESSAGES } from "./errors";

function createDepositFormData(overrides: Record<string, string> = {}) {
  const data = new FormData();
  data.set("reservationId", "1");
  data.set("depositMethod", PaymentMethod.CASH);
  data.set("depositReference", "REF-001");

  for (const [key, value] of Object.entries(overrides)) {
    if (value === "") {
      data.delete(key);
    } else {
      data.set(key, value);
    }
  }

  return data;
}

function createCheckInFormData(overrides: Record<string, string> = {}) {
  const data = new FormData();
  data.set("reservationId", "1");
  data.set("roomId", "101");
  data.set("guestFullName", "Budi Santoso");
  data.set("guestIdType", GuestIdType.KTP);
  data.set("guestIdNumber", "3273010101900001");
  data.set("guestPhone", "081234567890");
  data.set("guestEmail", "budi@example.com");
  data.set("guestNationality", "Indonesia");
  data.set("purposeOfVisit", "Liburan");
  data.set("purposeOfVisitOther", "");
  data.set("signatureDataUrl", "data:image/png;base64,aGVsbG8=");
  data.set("arrivalConfirmation", "true");

  for (const [key, value] of Object.entries(overrides)) {
    if (value === "") {
      data.delete(key);
    } else {
      data.set(key, value);
    }
  }

  return data;
}

const BASE_DATE = new Date();
BASE_DATE.setHours(0, 0, 0, 0);

const TOMORROW = new Date(BASE_DATE);
TOMORROW.setDate(TOMORROW.getDate() + 1);

const YESTERDAY = new Date(BASE_DATE);
YESTERDAY.setDate(YESTERDAY.getDate() - 1);

const FUTURE_DATE = new Date(BASE_DATE);
FUTURE_DATE.setDate(FUTURE_DATE.getDate() + 5);

describe("check-in server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({
      user: { id: "1", role: "FO" },
    });
    mocks.folioCount.mockResolvedValue(0);
    mocks.roomBlockFindMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getCheckInReviewData", () => {
    it("returns SESSION_EXPIRED when session is missing", async () => {
      mocks.auth.mockResolvedValueOnce(null);

      const result = await getCheckInReviewData(1);

      expect(result).toEqual({
        ok: false,
        code: "SESSION_EXPIRED",
        error: CHECK_IN_FAILURE_MESSAGES.SESSION_EXPIRED,
      });
      expect(mocks.reservationFindUnique).not.toHaveBeenCalled();
    });

    it("returns FORBIDDEN when user role is not FO", async () => {
      mocks.auth.mockResolvedValueOnce({
        user: { id: "2", role: "HK" },
      });

      const result = await getCheckInReviewData(1);

      expect(result).toEqual({
        ok: false,
        code: "FORBIDDEN",
        error: CHECK_IN_FAILURE_MESSAGES.FORBIDDEN,
      });
      expect(mocks.reservationFindUnique).not.toHaveBeenCalled();
    });

    it("returns INVALID_INPUT when reservationId is invalid", async () => {
      const result = await getCheckInReviewData(0);

      expect(result).toEqual({
        ok: false,
        code: "INVALID_INPUT",
        field: "reservationId",
        error: CHECK_IN_FAILURE_MESSAGES.INVALID_INPUT,
      });
    });

    it("returns RESERVATION_NOT_FOUND when reservation is not found", async () => {
      mocks.reservationFindUnique.mockResolvedValueOnce(null);

      const result = await getCheckInReviewData(999);

      expect(result).toEqual({
        ok: false,
        code: "RESERVATION_NOT_FOUND",
        error: CHECK_IN_FAILURE_MESSAGES.RESERVATION_NOT_FOUND,
      });
    });

    it("returns REVIEW_UNEXPECTED when findUnique throws unexpected error", async () => {
      mocks.reservationFindUnique.mockRejectedValueOnce(
        new Error("Connection reset by peer"),
      );

      const result = await getCheckInReviewData(1);

      expect(result).toEqual({
        ok: false,
        code: "REVIEW_UNEXPECTED",
        error: CHECK_IN_FAILURE_MESSAGES.REVIEW_UNEXPECTED,
      });
    });

    it("returns review data successfully with roomReady: true and deposit formatted", async () => {
      mocks.reservationFindUnique.mockResolvedValueOnce({
        id: 1,
        reservationNo: "RSV-001",
        reservationType: ReservationType.INDIVIDUAL,
        arrangementType: ArrangementType.RO,
        roomTypeId: 10,
        arrivalDate: BASE_DATE,
        departureDate: TOMORROW,
        adults: 2,
        children: 0,
        status: ReservationStatus.CONFIRMED,
        depositStatus: DepositStatus.COLLECTED,
        rateAmount: new Prisma.Decimal(350000),
        updatedAt: new Date("2026-08-01T10:00:00.000Z"),
        guest: {
          fullName: "Budi Santoso",
          idType: GuestIdType.KTP,
          idNumber: "3273010101900001",
          phone: "081234567890",
          email: "budi@example.com",
          nationality: "Indonesia",
        },
        room: {
          id: 101,
          number: "101",
          status: RoomStatus.VC,
          roomTypeId: 10,
        },
        roomType: { name: "Deluxe King" },
        folio: {
          payments: [
            {
              amount: new Prisma.Decimal(350000),
              method: PaymentMethod.CASH,
              reference: "REF-123",
            },
          ],
        },
        reservationNights: [
          { date: BASE_DATE, rateAmount: new Prisma.Decimal(350000) },
        ],
      });
      mocks.reservationFindFirst.mockResolvedValueOnce(null);

      const result = await getCheckInReviewData({ reservationId: 1 });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.review.reservationId).toBe(1);
        expect(result.review.roomReady).toBe(true);
        expect(result.review.deposit.status).toBe(DepositStatus.COLLECTED);
        expect(result.review.deposit.requiredAmount).toBe("350000");
        expect(result.review.deposit.payment).toEqual({
          amount: "350000",
          method: PaymentMethod.CASH,
          reference: "REF-123",
        });
      }
    });

    it("marks roomReady: false when room has overlapping reservation", async () => {
      mocks.reservationFindUnique.mockResolvedValueOnce({
        id: 1,
        reservationNo: "RSV-001",
        reservationType: ReservationType.INDIVIDUAL,
        arrangementType: ArrangementType.RO,
        roomTypeId: 10,
        arrivalDate: BASE_DATE,
        departureDate: TOMORROW,
        adults: 2,
        children: 0,
        status: ReservationStatus.CONFIRMED,
        depositStatus: DepositStatus.COLLECTED,
        rateAmount: new Prisma.Decimal(350000),
        updatedAt: new Date("2026-08-01T10:00:00.000Z"),
        guest: {
          fullName: "Budi Santoso",
          idType: GuestIdType.KTP,
          idNumber: "3273010101900001",
          phone: "081234567890",
          email: "budi@example.com",
          nationality: "Indonesia",
        },
        room: {
          id: 101,
          number: "101",
          status: RoomStatus.VC,
          roomTypeId: 10,
        },
        roomType: { name: "Deluxe King" },
        folio: null,
        reservationNights: [],
      });
      mocks.reservationFindFirst.mockResolvedValueOnce({ id: 99 });

      const result = await getFreshCheckInReview(1);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.review.roomReady).toBe(false);
      }
    });
  });

  describe("collectCheckInDeposit", () => {
    it("returns SESSION_EXPIRED when session is missing", async () => {
      mocks.auth.mockResolvedValueOnce(null);

      const result = await collectCheckInDeposit(createDepositFormData());

      expect(result).toEqual({
        ok: false,
        code: "SESSION_EXPIRED",
        error: CHECK_IN_FAILURE_MESSAGES.SESSION_EXPIRED,
      });
    });

    it("returns FORBIDDEN when user role is not FO", async () => {
      mocks.auth.mockResolvedValueOnce({
        user: { id: "2", role: "HK" },
      });

      const result = await collectCheckInDeposit(createDepositFormData());

      expect(result).toEqual({
        ok: false,
        code: "FORBIDDEN",
        error: CHECK_IN_FAILURE_MESSAGES.FORBIDDEN,
      });
    });

    it("returns INVALID_INPUT when form data is invalid", async () => {
      const data = new FormData();
      data.set("reservationId", "invalid");
      data.set("depositMethod", PaymentMethod.CASH);

      const result = await collectCheckInDeposit(data);

      expect(result).toEqual({
        ok: false,
        code: "INVALID_INPUT",
        field: "reservationId",
        error: CHECK_IN_FAILURE_MESSAGES.INVALID_INPUT,
      });
    });

    it("returns idempotent success when deposit is already COLLECTED with payment", async () => {
      mocks.transaction.mockImplementationOnce(async (callback) => {
        const tx = {
          reservation: {
            findUnique: vi.fn().mockResolvedValueOnce({
              status: ReservationStatus.CONFIRMED,
              depositStatus: DepositStatus.COLLECTED,
              arrivalDate: BASE_DATE,
              folio: {
                id: 10,
                payments: [
                  {
                    amount: new Prisma.Decimal(300000),
                    method: PaymentMethod.CASH,
                    reference: "DEP-REC",
                  },
                ],
              },
              reservationNights: [
                { rateAmount: new Prisma.Decimal(300000) },
              ],
            }),
          },
        };
        return callback(tx);
      });

      const result = await collectCheckInDeposit(createDepositFormData());

      expect(result).toEqual({
        ok: true,
        payment: {
          amount: "300000",
          method: PaymentMethod.CASH,
          reference: "DEP-REC",
        },
        alreadyCollected: true,
      });
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/fo/reservasi/1");
    });

    it("returns DEPOSIT_STATE_INCONSISTENT when deposit is COLLECTED without payment", async () => {
      mocks.transaction.mockImplementationOnce(async (callback) => {
        const tx = {
          reservation: {
            findUnique: vi.fn().mockResolvedValueOnce({
              status: ReservationStatus.CONFIRMED,
              depositStatus: DepositStatus.COLLECTED,
              arrivalDate: BASE_DATE,
              folio: {
                id: 10,
                payments: [],
              },
              reservationNights: [
                { rateAmount: new Prisma.Decimal(300000) },
              ],
            }),
          },
        };
        return callback(tx);
      });

      const result = await collectCheckInDeposit(createDepositFormData());

      expect(result).toEqual({
        ok: false,
        code: "DEPOSIT_STATE_INCONSISTENT",
        error: CHECK_IN_FAILURE_MESSAGES.DEPOSIT_STATE_INCONSISTENT,
      });
    });

    it("returns ARRIVAL_NOT_DUE when arrivalDate is in the future", async () => {
      mocks.transaction.mockImplementationOnce(async (callback) => {
        const tx = {
          reservation: {
            findUnique: vi.fn().mockResolvedValueOnce({
              status: ReservationStatus.CONFIRMED,
              depositStatus: DepositStatus.PENDING,
              arrivalDate: FUTURE_DATE,
              folio: null,
              reservationNights: [
                { rateAmount: new Prisma.Decimal(300000) },
              ],
            }),
          },
        };
        return callback(tx);
      });

      const result = await collectCheckInDeposit(createDepositFormData());

      expect(result).toEqual({
        ok: false,
        code: "ARRIVAL_NOT_DUE",
        error: CHECK_IN_FAILURE_MESSAGES.ARRIVAL_NOT_DUE,
      });
    });

    it("returns DEPOSIT_CONFLICT on serialization conflict P2034", async () => {
      const conflictError = new Prisma.PrismaClientKnownRequestError(
        "Serialization conflict",
        { code: "P2034", clientVersion: "6.0.0" },
      );

      mocks.transaction.mockRejectedValue(conflictError);

      const result = await collectCheckInDeposit(createDepositFormData());

      expect(result).toEqual({
        ok: false,
        code: "DEPOSIT_CONFLICT",
        error: CHECK_IN_FAILURE_MESSAGES.DEPOSIT_CONFLICT,
      });
    });

    it("returns DEPOSIT_UNEXPECTED without leaking raw error message", async () => {
      const rawError = new Error("Connection failed catastrophically");
      mocks.transaction.mockRejectedValueOnce(rawError);

      const result = await collectCheckInDeposit(createDepositFormData());

      expect(result).toEqual({
        ok: false,
        code: "DEPOSIT_UNEXPECTED",
        error: CHECK_IN_FAILURE_MESSAGES.DEPOSIT_UNEXPECTED,
      });
      if (!result.ok) {
        expect(result.error).not.toContain("Connection failed");
      }
    });

    it("preserves truthful success if post-commit side-effect throws", async () => {
      mocks.transaction.mockImplementationOnce(async (callback) => {
        const tx = {
          reservation: {
            findUnique: vi.fn().mockResolvedValueOnce({
              status: ReservationStatus.CONFIRMED,
              depositStatus: DepositStatus.PENDING,
              arrivalDate: BASE_DATE,
              folio: null,
              reservationNights: [
                { rateAmount: new Prisma.Decimal(300000) },
              ],
            }),
            updateMany: vi.fn().mockResolvedValueOnce({ count: 1 }),
          },
          folio: {
            create: vi.fn().mockResolvedValueOnce({ id: 10 }),
          },
          payment: {
            create: vi.fn().mockResolvedValueOnce({
              amount: new Prisma.Decimal(300000),
              method: PaymentMethod.CASH,
              reference: "REF-001",
            }),
          },
        };
        return callback(tx);
      });

      mocks.revalidatePath.mockImplementationOnce(() => {
        throw new Error("Revalidation queue unavailable");
      });

      const result = await collectCheckInDeposit(createDepositFormData());

      expect(result).toEqual({
        ok: true,
        payment: {
          amount: "300000",
          method: PaymentMethod.CASH,
          reference: "REF-001",
        },
        alreadyCollected: false,
      });
    });

    it("returns DEPOSIT_RATE_UNAVAILABLE when reservation nights are missing", async () => {
      mocks.transaction.mockImplementationOnce(async (callback) => {
        const tx = {
          reservation: {
            findUnique: vi.fn().mockResolvedValueOnce({
              status: ReservationStatus.CONFIRMED,
              depositStatus: DepositStatus.PENDING,
              arrivalDate: BASE_DATE,
              folio: null,
              reservationNights: [],
            }),
          },
        };
        return callback(tx);
      });

      const result = await collectCheckInDeposit(createDepositFormData());

      expect(result).toEqual({
        ok: false,
        code: "DEPOSIT_RATE_UNAVAILABLE",
        error: CHECK_IN_FAILURE_MESSAGES.DEPOSIT_RATE_UNAVAILABLE,
      });
    });

    it("returns DEPOSIT_RATE_UNAVAILABLE when first night rateAmount is not positive", async () => {
      mocks.transaction.mockImplementationOnce(async (callback) => {
        const tx = {
          reservation: {
            findUnique: vi.fn().mockResolvedValueOnce({
              status: ReservationStatus.CONFIRMED,
              depositStatus: DepositStatus.PENDING,
              arrivalDate: BASE_DATE,
              folio: null,
              reservationNights: [
                { rateAmount: new Prisma.Decimal(-50000) },
              ],
            }),
          },
        };
        return callback(tx);
      });

      const result = await collectCheckInDeposit(createDepositFormData());

      expect(result).toEqual({
        ok: false,
        code: "DEPOSIT_RATE_UNAVAILABLE",
        error: CHECK_IN_FAILURE_MESSAGES.DEPOSIT_RATE_UNAVAILABLE,
      });
    });
  });

  describe("collectAdvanceReservationDeposit", () => {
    const input = { reservationId: 1, depositMethod: PaymentMethod.CASH };

    function mockAdvanceTransaction(overrides: Record<string, unknown> = {}) {
      const reservation = {
        status: ReservationStatus.CONFIRMED,
        depositStatus: DepositStatus.PENDING,
        arrivalDate: FUTURE_DATE,
        groupBookingId: "group-1",
        folio: null,
        reservationNights: [{ rateAmount: new Prisma.Decimal(500000) }],
        ...overrides,
      };
      const tx = {
        reservation: {
          findUnique: vi.fn().mockResolvedValue(reservation),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        folio: { create: vi.fn().mockResolvedValue({ id: 10 }) },
        payment: {
          create: vi.fn().mockResolvedValue({
            amount: new Prisma.Decimal(500000),
            method: PaymentMethod.CASH,
            reference: null,
          }),
        },
      };
      mocks.transaction.mockImplementation(async (callback) => callback(tx));
      return tx;
    }

    it("collects a future deposit using the session operator and logs after commit", async () => {
      const tx = mockAdvanceTransaction();
      mocks.auth.mockResolvedValue({ user: { id: "42", role: "FO" } });
      const result = await collectAdvanceReservationDeposit({ ...input, ...{ userId: 999 } });
      expect(result).toEqual({
        ok: true,
        payment: { amount: "500000", method: PaymentMethod.CASH, reference: null },
        alreadyCollected: false,
      });
      expect(tx.payment.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ receivedById: 42, purpose: "DEPOSIT", amount: new Prisma.Decimal(500000) }),
      }));
      expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: "Serializable" }));
      expect(mocks.logActivity).toHaveBeenCalledWith(expect.objectContaining({
        userId: 42, action: "PAYMENT_RECORDED", reservationId: 1,
                metadata: expect.objectContaining({ event: "DEPOSIT_COLLECTED", purpose: "DEPOSIT" }),
      }));
      expect(mocks.logActivity.mock.invocationCallOrder[0]).toBeGreaterThan(tx.reservation.updateMany.mock.invocationCallOrder[0]);
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/fo/reservasi/1");
    });

    it.each([
      [null, "SESSION_EXPIRED"],
      [{ user: { id: "1", role: "HK" } }, "FORBIDDEN"],
    ])("rejects unauthorized sessions: %j", async (session, code) => {
      mocks.auth.mockResolvedValue(session);
      expect(await collectAdvanceReservationDeposit(input)).toMatchObject({ ok: false, code });
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it.each([
      [{ ...input, reservationId: 0 }, "reservationId"],
      [{ ...input, depositMethod: "INVALID" }, "depositMethod"],
      [{ ...input, depositMethod: PaymentMethod.TRANSFER }, "depositReference"],
      [{ ...input, depositMethod: PaymentMethod.TRANSFER, depositReference: "   " }, "depositReference"],
    ])("validates input before collection: %j", async (invalid, field) => {
      expect(await collectAdvanceReservationDeposit(invalid)).toMatchObject({ ok: false, code: "INVALID_INPUT", field });
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("normalizes a valid transfer reference", async () => {
      const tx = mockAdvanceTransaction();
      await collectAdvanceReservationDeposit({ ...input, depositMethod: PaymentMethod.TRANSFER, depositReference: " REF-001 " });
      expect(tx.payment.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ method: PaymentMethod.TRANSFER, reference: "REF-001" }),
      }));
    });

    it.each([
      [{ status: ReservationStatus.CANCELLED }, "DEPOSIT_NOT_ELIGIBLE"],
      [{ reservationNights: [] }, "DEPOSIT_RATE_UNAVAILABLE"],
      [{ reservationNights: [{ rateAmount: new Prisma.Decimal(0) }] }, "DEPOSIT_RATE_UNAVAILABLE"],
      [{ depositStatus: DepositStatus.COLLECTED }, "DEPOSIT_STATE_INCONSISTENT"],
      [{ folio: { id: 10, payments: [{ amount: new Prisma.Decimal(500000) }] } }, "DEPOSIT_STATE_INCONSISTENT"],
    ])("preserves transaction guards: %j", async (overrides, code) => {
      const tx = mockAdvanceTransaction(overrides);
      expect(await collectAdvanceReservationDeposit(input)).toMatchObject({ ok: false, code });
      expect(tx.payment.create).not.toHaveBeenCalled();
      expect(mocks.logActivity).not.toHaveBeenCalled();
    });

    it("preserves the conditional-write conflict guard", async () => {
      const tx = mockAdvanceTransaction();
      tx.reservation.updateMany.mockResolvedValue({ count: 0 });
      expect(await collectAdvanceReservationDeposit(input)).toMatchObject({ ok: false, code: "DEPOSIT_CONFLICT" });
      expect(mocks.logActivity).not.toHaveBeenCalled();
    });

    it("returns idempotent future success without another payment or activity entry", async () => {
      const tx = mockAdvanceTransaction({
        depositStatus: DepositStatus.COLLECTED,
        folio: { id: 10, payments: [{ amount: new Prisma.Decimal(500000), method: PaymentMethod.CASH, reference: null }] },
      });
      expect(await collectAdvanceReservationDeposit(input)).toMatchObject({ ok: true, alreadyCollected: true });
      expect(tx.payment.create).not.toHaveBeenCalled();
      expect(mocks.logActivity).not.toHaveBeenCalled();
    });

    it("keeps success truthful when post-commit logging fails", async () => {
      mockAdvanceTransaction();
      mocks.logActivity.mockRejectedValueOnce(new Error("Log unavailable"));
      vi.spyOn(console, "error").mockImplementation(() => {});
      expect(await collectAdvanceReservationDeposit(input)).toMatchObject({ ok: true, alreadyCollected: false });
      expect(mocks.transaction).toHaveBeenCalledTimes(1);
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/fo/reservasi/1");
    });

    it("does not allow transport options to bypass the ordinary arrival gate", async () => {
      const tx = mockAdvanceTransaction();
      const result = await collectCheckInDeposit(createDepositFormData({ allowPreArrival: "true" }));
      expect(result).toMatchObject({ ok: false, code: "ARRIVAL_NOT_DUE" });
      expect(tx.payment.create).not.toHaveBeenCalled();
      expect(mocks.logActivity).not.toHaveBeenCalled();
    });

    it.each(["P2002", "P2034"])("preserves retries for %s and logs only once", async (code) => {
      const tx = mockAdvanceTransaction();
      mocks.transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError(
        "Retry transaction", { code, clientVersion: "6.0.0" },
      ));
      expect(await collectAdvanceReservationDeposit(input)).toMatchObject({ ok: true, alreadyCollected: false });
      expect(mocks.transaction).toHaveBeenCalledTimes(2);
      expect(tx.payment.create).toHaveBeenCalledTimes(1);
      expect(mocks.logActivity).toHaveBeenCalledTimes(1);
    });

    it("returns conflict without logging when serialization retries are exhausted", async () => {
      mockAdvanceTransaction();
      const error = new Prisma.PrismaClientKnownRequestError(
        "Serialization conflict", { code: "P2034", clientVersion: "6.0.0" },
      );
      mocks.transaction.mockRejectedValueOnce(error).mockRejectedValueOnce(error).mockRejectedValueOnce(error);
      expect(await collectAdvanceReservationDeposit(input)).toMatchObject({ ok: false, code: "DEPOSIT_CONFLICT" });
      expect(mocks.transaction).toHaveBeenCalledTimes(3);
      expect(mocks.logActivity).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("still rejects future group deposits", async () => {
      const tx = mockAdvanceTransaction();
      expect(await collectCheckInDepositForGroup({ ...input, groupBookingId: "group-1" })).toMatchObject({ ok: false, code: "ARRIVAL_NOT_DUE" });
      expect(tx.payment.create).not.toHaveBeenCalled();
    });
  });

  describe("collectCheckInDepositForGroup", () => {
    it("returns SESSION_EXPIRED when session is missing", async () => {
      mocks.auth.mockResolvedValueOnce(null);

      const result = await collectCheckInDepositForGroup({
        reservationId: 1,
        depositMethod: PaymentMethod.CASH,
        groupBookingId: "GRP-001",
      });

      expect(result).toEqual({
        ok: false,
        code: "SESSION_EXPIRED",
        error: CHECK_IN_FAILURE_MESSAGES.SESSION_EXPIRED,
      });
    });

    it("returns FORBIDDEN when user role is not FO", async () => {
      mocks.auth.mockResolvedValueOnce({
        user: { id: "2", role: "HK" },
      });

      const result = await collectCheckInDepositForGroup({
        reservationId: 1,
        depositMethod: PaymentMethod.CASH,
        groupBookingId: "GRP-001",
      });

      expect(result).toEqual({
        ok: false,
        code: "FORBIDDEN",
        error: CHECK_IN_FAILURE_MESSAGES.FORBIDDEN,
      });
    });

    it("returns INVALID_INPUT when groupBookingId is empty", async () => {
      const result = await collectCheckInDepositForGroup({
        reservationId: 1,
        depositMethod: PaymentMethod.CASH,
        groupBookingId: "   ",
      });

      expect(result).toEqual({
        ok: false,
        code: "INVALID_INPUT",
        field: "groupBookingId",
        error: CHECK_IN_FAILURE_MESSAGES.INVALID_INPUT,
      });
    });

    it("returns DEPOSIT_NOT_ELIGIBLE when reservation groupBookingId does not match expected", async () => {
      mocks.transaction.mockImplementationOnce(async (callback) => {
        const tx = {
          reservation: {
            findUnique: vi.fn().mockResolvedValueOnce({
              status: ReservationStatus.CONFIRMED,
              depositStatus: DepositStatus.PENDING,
              arrivalDate: BASE_DATE,
              groupBookingId: "GRP-OTHER",
              folio: null,
              reservationNights: [
                { rateAmount: new Prisma.Decimal(300000) },
              ],
            }),
          },
        };
        return callback(tx);
      });

      const result = await collectCheckInDepositForGroup({
        reservationId: 1,
        depositMethod: PaymentMethod.CASH,
        groupBookingId: "GRP-001",
      });

      expect(result).toEqual({
        ok: false,
        code: "DEPOSIT_NOT_ELIGIBLE",
        error: CHECK_IN_FAILURE_MESSAGES.DEPOSIT_NOT_ELIGIBLE,
      });
    });
  });

  describe("completeCheckIn", () => {
    it("returns SESSION_EXPIRED when session is missing", async () => {
      mocks.auth.mockResolvedValueOnce(null);

      const result = await completeCheckIn(createCheckInFormData());

      expect(result).toEqual({
        ok: false,
        code: "SESSION_EXPIRED",
        error: CHECK_IN_FAILURE_MESSAGES.SESSION_EXPIRED,
      });
    });

    it("returns FORBIDDEN when user role is not FO", async () => {
      mocks.auth.mockResolvedValueOnce({
        user: { id: "2", role: "ACC" },
      });

      const result = await completeCheckIn(createCheckInFormData());

      expect(result).toEqual({
        ok: false,
        code: "FORBIDDEN",
        error: CHECK_IN_FAILURE_MESSAGES.FORBIDDEN,
      });
    });

    it("returns GRC_INCOMPLETE when signatureDataUrl is missing", async () => {
      const data = createCheckInFormData({ signatureDataUrl: "" });

      const result = await completeCheckIn(data);

      expect(result).toEqual({
        ok: false,
        code: "GRC_INCOMPLETE",
        field: "signatureDataUrl",
        error: CHECK_IN_FAILURE_MESSAGES.GRC_INCOMPLETE,
      });
    });

    it("returns GRC_INCOMPLETE when arrivalConfirmation is missing", async () => {
      const data = createCheckInFormData({ arrivalConfirmation: "" });

      const result = await completeCheckIn(data);

      expect(result).toEqual({
        ok: false,
        code: "GRC_INCOMPLETE",
        field: "arrivalConfirmation",
        error: CHECK_IN_FAILURE_MESSAGES.GRC_INCOMPLETE,
      });
    });

    it("returns GRC_INCOMPLETE when purposeOfVisit is invalid or missing", async () => {
      const data = createCheckInFormData({ purposeOfVisit: "" });

      const result = await completeCheckIn(data);

      expect(result).toEqual({
        ok: false,
        code: "GRC_INCOMPLETE",
        field: "purposeOfVisit",
        error: CHECK_IN_FAILURE_MESSAGES.GRC_INCOMPLETE,
      });
    });

    it("returns GRC_INCOMPLETE when purposeOfVisit is Lainnya but purposeOfVisitOther is empty", async () => {
      const data = createCheckInFormData({
        purposeOfVisit: "Lainnya",
        purposeOfVisitOther: "",
      });

      const result = await completeCheckIn(data);

      expect(result).toEqual({
        ok: false,
        code: "GRC_INCOMPLETE",
        field: "purposeOfVisitOther",
        error: CHECK_IN_FAILURE_MESSAGES.GRC_INCOMPLETE,
      });
    });

    it("returns ROOM_REQUIRED when roomId is missing from form data", async () => {
      const data = createCheckInFormData({ roomId: "" });

      const result = await completeCheckIn(data);

      expect(result).toEqual({
        ok: false,
        code: "ROOM_REQUIRED",
        field: "roomId",
        error: CHECK_IN_FAILURE_MESSAGES.ROOM_REQUIRED,
      });
    });

    it("returns ROOM_REQUIRED when room is not found in database", async () => {
      mocks.reservationFindUnique.mockResolvedValueOnce({
        id: 1,
        roomTypeId: 10,
        guestId: 5,
        arrivalDate: BASE_DATE,
        departureDate: TOMORROW,
        status: ReservationStatus.CONFIRMED,
      });
      mocks.roomFindUnique.mockResolvedValueOnce(null);

      const result = await completeCheckIn(createCheckInFormData());

      expect(result).toEqual({
        ok: false,
        code: "ROOM_REQUIRED",
        field: "roomId",
        error: CHECK_IN_FAILURE_MESSAGES.ROOM_REQUIRED,
      });
    });

    it("returns CHECK_IN_UNEXPECTED when preflight context preparation encounters unexpected error", async () => {
      mocks.reservationFindUnique.mockRejectedValueOnce(
        new Error("Database connection dropped during preflight"),
      );

      const result = await completeCheckIn(createCheckInFormData());

      expect(result).toEqual({
        ok: false,
        code: "CHECK_IN_UNEXPECTED",
        error: CHECK_IN_FAILURE_MESSAGES.CHECK_IN_UNEXPECTED,
      });
    });

    it("returns ROOM_BLOCKED when assigned room has a dated block", async () => {
          mocks.roomBlockFindMany.mockResolvedValueOnce([{ id: 1, roomId: 101, startDate: BASE_DATE, endDate: TOMORROW, reason: "MAINTENANCE", status: "ACTIVE" }]);
      mocks.reservationFindUnique.mockResolvedValueOnce({
        id: 1,
        roomTypeId: 10,
        guestId: 5,
        arrivalDate: BASE_DATE,
        departureDate: TOMORROW,
        status: ReservationStatus.CONFIRMED,
      });
      mocks.roomFindUnique.mockResolvedValueOnce({
        id: 101,
        number: "101",
        roomTypeId: 10,
        status: RoomStatus.OOO,
      });

      const result = await completeCheckIn(createCheckInFormData());

      expect(result).toEqual({
        ok: false,
        code: "ROOM_BLOCKED",
        field: "roomId",
        error: expect.stringContaining("Room blocked for Maintenance"),
      });
    });

    it("returns ROOM_TYPE_MISMATCH when room type does not match reservation", async () => {
      mocks.reservationFindUnique.mockResolvedValueOnce({
        id: 1,
        roomTypeId: 10,
        guestId: 5,
        arrivalDate: BASE_DATE,
        departureDate: TOMORROW,
        status: ReservationStatus.CONFIRMED,
      });
      mocks.roomFindUnique.mockResolvedValueOnce({
        id: 101,
        number: "101",
        roomTypeId: 20,
        status: RoomStatus.VC,
      });

      const result = await completeCheckIn(createCheckInFormData());

      expect(result).toEqual({
        ok: false,
        code: "ROOM_TYPE_MISMATCH",
        field: "roomId",
        error: CHECK_IN_FAILURE_MESSAGES.ROOM_TYPE_MISMATCH,
      });
    });

    it("returns ROOM_OVERLAP when room has active overlapping reservation", async () => {
      mocks.reservationFindUnique.mockResolvedValueOnce({
        id: 1,
        roomTypeId: 10,
        guestId: 5,
        arrivalDate: BASE_DATE,
        departureDate: TOMORROW,
        status: ReservationStatus.CONFIRMED,
      });
      mocks.roomFindUnique.mockResolvedValueOnce({
        id: 101,
        number: "101",
        roomTypeId: 10,
        status: RoomStatus.VC,
      });
      mocks.reservationFindFirst.mockResolvedValueOnce({ id: 99 });

      const result = await completeCheckIn(createCheckInFormData());

      expect(result).toEqual({
        ok: false,
        code: "ROOM_UNAVAILABLE",
        field: "roomId",
        error: CHECK_IN_FAILURE_MESSAGES.ROOM_UNAVAILABLE,
      });
    });

    function mockValidCheckInPreflight() {
      mocks.reservationFindUnique.mockResolvedValueOnce({
        id: 1,
        roomTypeId: 10,
        guestId: 5,
        arrivalDate: BASE_DATE,
        departureDate: TOMORROW,
        status: ReservationStatus.CONFIRMED,
      });
      mocks.roomFindUnique.mockResolvedValueOnce({
        id: 101,
        number: "101",
        roomTypeId: 10,
        status: RoomStatus.VC,
      });
      mocks.reservationFindFirst.mockResolvedValueOnce(null);
    }

    function createCheckInTxMock() {
      return {
        $queryRaw: vi.fn().mockResolvedValue([]),
        roomBlock: { findMany: vi.fn().mockResolvedValue([]) },
        reservation: {
          findFirst: vi.fn().mockResolvedValueOnce(null),
          findUnique: vi.fn().mockResolvedValueOnce({
            id: 1,
            roomTypeId: 10,
            guestId: 5,
            arrivalDate: BASE_DATE,
            departureDate: TOMORROW,
            status: ReservationStatus.CONFIRMED,
            depositStatus: DepositStatus.COLLECTED,
            folio: {
              id: 10,
              status: "OPEN",
              payments: [{ amount: new Prisma.Decimal(300000) }],
            },
          }),
          updateMany: vi.fn().mockResolvedValueOnce({ count: 1 }),
          findUniqueOrThrow: vi.fn().mockResolvedValueOnce({
            reservationNo: "RSV-001",
            arrivalDate: BASE_DATE,
            departureDate: TOMORROW,
            arrangementType: ArrangementType.RO,
            reservationType: ReservationType.INDIVIDUAL,
            adults: 1,
            children: 0,
            rateAmount: new Prisma.Decimal(300000),
            purposeOfVisit: "Liburan",
            grcFilledAt: new Date(),
            signatureDataUrl: "data:image/png;base64,aGVsbG8=",
            signedAt: new Date(),
            grcSnapshot: null,
            folio: { folioNo: "FOL-0001" },
            guest: {
              fullName: "Budi",
              idType: GuestIdType.KTP,
              idNumber: "123",
              phone: null,
              email: null,
              nationality: "ID",
            },
            room: { number: "101" },
            roomType: { name: "Deluxe" },
            reservationNights: [
              { date: BASE_DATE, rateAmount: new Prisma.Decimal(300000) },
            ],
          }),
          update: vi.fn().mockResolvedValueOnce({ id: 1 }),
        },
        reservationNight: {
          findFirst: vi.fn().mockResolvedValueOnce({
            rateAmount: new Prisma.Decimal(300000),
          }),
        },
        guest: {
          update: vi.fn().mockResolvedValueOnce({ id: 5 }),
        },
        user: {
          findUniqueOrThrow: vi.fn().mockResolvedValueOnce({
            fullName: "Operator FO",
          }),
        },
        hotelSettings: {
          findUnique: vi.fn().mockResolvedValueOnce({
            address: "Jl. Telekomunikasi",
          }),
        },
        room: {
          findUnique: vi.fn().mockResolvedValueOnce({
            id: 101,
            number: "101",
            roomTypeId: 10,
            status: RoomStatus.VC,
          }),
          updateMany: vi.fn().mockResolvedValueOnce({ count: 1 }),
        },
      };
    }

    it("allows a stale OOO status when no block overlaps the stay", async () => {
      mockValidCheckInPreflight();
      mocks.roomFindUnique.mockReset().mockResolvedValue({ id: 101, number: "101", roomTypeId: 10, status: RoomStatus.OOO });
      mocks.transaction.mockImplementationOnce(async (callback) => callback(createCheckInTxMock()));
      expect(await completeCheckIn(createCheckInFormData(), { redirectAfterCheckIn: false })).toEqual({ ok: true });
    });

    it("rejects a block introduced after preflight inside the locked transaction", async () => {
      mockValidCheckInPreflight();
      const tx = createCheckInTxMock();
      tx.roomBlock.findMany.mockResolvedValueOnce([{ id: 1, roomId: 101, startDate: BASE_DATE, endDate: TOMORROW, reason: "MAINTENANCE", status: "ACTIVE" }]);
      mocks.transaction.mockImplementationOnce(async (callback) => callback(tx));
      expect(await completeCheckIn(createCheckInFormData(), { redirectAfterCheckIn: false })).toMatchObject({ ok: false, code: "ROOM_BLOCKED" });
      expect(tx.guest.update).not.toHaveBeenCalled();
      expect(tx.reservation.updateMany).not.toHaveBeenCalled();
    });

    it("returns STAY_FEE_UNAVAILABLE when ReservationStayFeeError is thrown", async () => {
      mockValidCheckInPreflight();

      mocks.transaction.mockImplementationOnce(async (callback) => {
        const tx = createCheckInTxMock();
        mocks.postPendingReservationStayFees.mockRejectedValueOnce(
          new ReservationStayFeeError("Stay fee failed"),
        );
        return callback(tx);
      });

      const result = await completeCheckIn(createCheckInFormData(), {
        redirectAfterCheckIn: false,
      });

      expect(result).toEqual({
        ok: false,
        code: "STAY_FEE_UNAVAILABLE",
        error: CHECK_IN_FAILURE_MESSAGES.STAY_FEE_UNAVAILABLE,
      });
    });

    it("succeeds with options.redirectAfterCheckIn: false and does not call redirect", async () => {
      mockValidCheckInPreflight();

      mocks.transaction.mockImplementationOnce(async (callback) => {
        const tx = createCheckInTxMock();
        mocks.postPendingReservationStayFees.mockResolvedValueOnce(undefined);
        return callback(tx);
      });

      const result = await completeCheckIn(createCheckInFormData(), {
        redirectAfterCheckIn: false,
      });

      expect(result).toEqual({ ok: true });
      expect(mocks.redirect).not.toHaveBeenCalled();
      expect(mocks.logActivity).toHaveBeenCalledTimes(1);
      expect(mocks.revalidatePath).toHaveBeenCalledWith(
        "/app/fo/reservasi/kalender",
      );
      expect(mocks.revalidatePath).toHaveBeenCalledWith(
        "/app/fo/reservasi/list",
      );
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/fo/reservasi/1");
    });

    it("redirects to /app/fo/reservasi by default when redirectAfterCheckIn is omitted", async () => {
      mockValidCheckInPreflight();

      mocks.transaction.mockImplementationOnce(async (callback) => {
        const tx = createCheckInTxMock();
        mocks.postPendingReservationStayFees.mockResolvedValueOnce(undefined);
        return callback(tx);
      });

      await completeCheckIn(createCheckInFormData());

      expect(mocks.redirect).toHaveBeenCalledWith("/app/fo/reservasi");
    });

    it("returns DEPOSIT_RATE_UNAVAILABLE when first night is missing in check-in transaction", async () => {
      mockValidCheckInPreflight();

      mocks.transaction.mockImplementationOnce(async (callback) => {
        const tx = createCheckInTxMock();
        tx.reservationNight.findFirst = vi.fn().mockResolvedValueOnce(null);
        return callback(tx);
      });

      const result = await completeCheckIn(createCheckInFormData(), {
        redirectAfterCheckIn: false,
      });

      expect(result).toEqual({
        ok: false,
        code: "DEPOSIT_RATE_UNAVAILABLE",
        error: CHECK_IN_FAILURE_MESSAGES.DEPOSIT_RATE_UNAVAILABLE,
      });
    });

    it("returns DEPOSIT_REQUIRED when reservation depositStatus is PENDING in transaction", async () => {
      mockValidCheckInPreflight();

      mocks.transaction.mockImplementationOnce(async (callback) => {
        const tx = createCheckInTxMock();
        tx.reservation.findUnique = vi.fn().mockResolvedValueOnce({
          id: 1,
          roomTypeId: 10,
          guestId: 5,
          arrivalDate: BASE_DATE,
          departureDate: TOMORROW,
          status: ReservationStatus.CONFIRMED,
          depositStatus: DepositStatus.PENDING,
          folio: {
            id: 10,
            status: "OPEN",
            payments: [{ amount: new Prisma.Decimal(300000) }],
          },
        });
        return callback(tx);
      });

      const result = await completeCheckIn(createCheckInFormData(), {
        redirectAfterCheckIn: false,
      });

      expect(result).toEqual({
        ok: false,
        code: "DEPOSIT_REQUIRED",
        error: CHECK_IN_FAILURE_MESSAGES.DEPOSIT_REQUIRED,
      });
    });

    it("returns DEPOSIT_FOLIO_MISSING when folio is missing in transaction", async () => {
      mockValidCheckInPreflight();

      mocks.transaction.mockImplementationOnce(async (callback) => {
        const tx = createCheckInTxMock();
        tx.reservation.findUnique = vi.fn().mockResolvedValueOnce({
          id: 1,
          roomTypeId: 10,
          guestId: 5,
          arrivalDate: BASE_DATE,
          departureDate: TOMORROW,
          status: ReservationStatus.CONFIRMED,
          depositStatus: DepositStatus.COLLECTED,
          folio: null,
        });
        return callback(tx);
      });

      const result = await completeCheckIn(createCheckInFormData(), {
        redirectAfterCheckIn: false,
      });

      expect(result).toEqual({
        ok: false,
        code: "DEPOSIT_FOLIO_MISSING",
        error: CHECK_IN_FAILURE_MESSAGES.DEPOSIT_FOLIO_MISSING,
      });
    });

    it("returns DEPOSIT_STATE_INCONSISTENT when folio has no DEPOSIT payments", async () => {
      mockValidCheckInPreflight();

      mocks.transaction.mockImplementationOnce(async (callback) => {
        const tx = createCheckInTxMock();
        tx.reservation.findUnique = vi.fn().mockResolvedValueOnce({
          id: 1,
          roomTypeId: 10,
          guestId: 5,
          arrivalDate: BASE_DATE,
          departureDate: TOMORROW,
          status: ReservationStatus.CONFIRMED,
          depositStatus: DepositStatus.COLLECTED,
          folio: {
            id: 10,
            status: "OPEN",
            payments: [],
          },
        });
        return callback(tx);
      });

      const result = await completeCheckIn(createCheckInFormData(), {
        redirectAfterCheckIn: false,
      });

      expect(result).toEqual({
        ok: false,
        code: "DEPOSIT_STATE_INCONSISTENT",
        error: CHECK_IN_FAILURE_MESSAGES.DEPOSIT_STATE_INCONSISTENT,
      });
    });

    it("returns CHECK_IN_CONFLICT when CAS updateMany affects 0 rows", async () => {
      mockValidCheckInPreflight();

      mocks.transaction.mockImplementationOnce(async (callback) => {
        const tx = createCheckInTxMock();
        tx.reservation.updateMany = vi.fn().mockResolvedValueOnce({ count: 0 });
        return callback(tx);
      });

      const result = await completeCheckIn(createCheckInFormData(), {
        redirectAfterCheckIn: false,
      });

      expect(result).toEqual({
        ok: false,
        code: "CHECK_IN_CONFLICT",
        error: CHECK_IN_FAILURE_MESSAGES.CHECK_IN_CONFLICT,
      });
    });

    it("retries on transient serialization error and succeeds on second attempt", async () => {
      mockValidCheckInPreflight();

      const p2034Error = new Prisma.PrismaClientKnownRequestError(
        "Serialization conflict",
        { code: "P2034", clientVersion: "6.19.3" },
      );

      mocks.transaction
        .mockRejectedValueOnce(p2034Error)
        .mockImplementationOnce(async (callback) => {
          const tx = createCheckInTxMock();
          mocks.postPendingReservationStayFees.mockResolvedValueOnce(undefined);
          return callback(tx);
        });

      const result = await completeCheckIn(createCheckInFormData(), {
        redirectAfterCheckIn: false,
      });

      expect(result).toEqual({ ok: true });
      expect(mocks.transaction).toHaveBeenCalledTimes(2);
    });

    it("returns CHECK_IN_CONFLICT when serialization conflict persists across retries", async () => {
      mockValidCheckInPreflight();

      const p2034Error = new Prisma.PrismaClientKnownRequestError(
        "Serialization conflict",
        { code: "P2034", clientVersion: "6.19.3" },
      );

      mocks.transaction
        .mockRejectedValueOnce(p2034Error)
        .mockRejectedValueOnce(p2034Error)
        .mockRejectedValueOnce(p2034Error);

      const result = await completeCheckIn(createCheckInFormData(), {
        redirectAfterCheckIn: false,
      });

      expect(result).toEqual({
        ok: false,
        code: "CHECK_IN_CONFLICT",
        error: CHECK_IN_FAILURE_MESSAGES.CHECK_IN_CONFLICT,
      });
      expect(mocks.transaction).toHaveBeenCalledTimes(3);
    });
  });
});
