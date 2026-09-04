import { DepositStatus, PaymentMethod, ReservationStatus } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  reservationFindMany: vi.fn(),
  collectCheckInDepositForGroup: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    reservation: {
      findMany: mocks.reservationFindMany,
    },
  },
}));
vi.mock("@/lib/check-in/actions", () => ({
  collectCheckInDepositForGroup: mocks.collectCheckInDepositForGroup,
}));

import {
  CHECK_IN_FAILURE_MESSAGES,
  CHECK_IN_UNKNOWN_RESULT_MESSAGES,
  GROUP_MUTATION_UNCERTAIN_MESSAGE,
} from "@/lib/check-in/errors";
import { collectGroupDeposits } from "./actions";

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

const FUTURE_DATE = new Date(TODAY);
FUTURE_DATE.setDate(FUTURE_DATE.getDate() + 5);

describe("group check-in and deposit actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({
      user: { id: "1", role: "FO" },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("collectGroupDeposits", () => {
    it("returns SESSION_EXPIRED when session is missing", async () => {
      mocks.auth.mockResolvedValueOnce(null);

      const result = await collectGroupDeposits({
        groupBookingId: "GRP-001",
        method: PaymentMethod.CASH,
      });

      expect(result).toEqual({
        ok: false,
        error: CHECK_IN_FAILURE_MESSAGES.SESSION_EXPIRED,
      });
      expect(mocks.reservationFindMany).not.toHaveBeenCalled();
    });

    it("returns FORBIDDEN when user role is not FO", async () => {
      mocks.auth.mockResolvedValueOnce({
        user: { id: "2", role: "HK" },
      });

      const result = await collectGroupDeposits({
        groupBookingId: "GRP-001",
        method: PaymentMethod.CASH,
      });

      expect(result).toEqual({
        ok: false,
        error: CHECK_IN_FAILURE_MESSAGES.FORBIDDEN,
      });
      expect(mocks.reservationFindMany).not.toHaveBeenCalled();
    });

    it("returns INVALID_INPUT when groupBookingId is empty", async () => {
      const result = await collectGroupDeposits({
        groupBookingId: "   ",
        method: PaymentMethod.CASH,
      });

      expect(result).toEqual({
        ok: false,
        error: CHECK_IN_FAILURE_MESSAGES.INVALID_INPUT,
      });
    });

    it("returns INVALID_INPUT when method is TRANSFER but reference is missing", async () => {
      const result = await collectGroupDeposits({
        groupBookingId: "GRP-001",
        method: PaymentMethod.TRANSFER,
      });

      expect(result).toEqual({
        ok: false,
        error: CHECK_IN_FAILURE_MESSAGES.INVALID_INPUT,
      });
    });

    it("returns error when no reservations exist for group", async () => {
      mocks.reservationFindMany.mockResolvedValueOnce([]);

      const result = await collectGroupDeposits({
        groupBookingId: "GRP-EMPTY",
        method: PaymentMethod.CASH,
      });

      expect(result).toEqual({
        ok: false,
        error: "Tidak ada reservasi dalam booking grup ini.",
      });
    });

    it("returns REVIEW_UNEXPECTED when reservation query fails unexpectedly", async () => {
      mocks.reservationFindMany.mockRejectedValueOnce(
        new Error("Database connection timed out during group lookup"),
      );

      const result = await collectGroupDeposits({
        groupBookingId: "GRP-001",
        method: PaymentMethod.CASH,
      });

      expect(result).toEqual({
        ok: false,
        error: CHECK_IN_FAILURE_MESSAGES.REVIEW_UNEXPECTED,
      });
    });

    it("handles group partial failure preserving earlier completed rooms without leaking errors", async () => {
      mocks.reservationFindMany.mockResolvedValueOnce([
        // Sibling 1: already checked in -> skipped
        {
          id: 101,
          reservationNo: "RSV-101",
          status: ReservationStatus.CHECKED_IN,
          depositStatus: DepositStatus.COLLECTED,
          arrivalDate: TODAY,
          room: { number: "101" },
          folio: { payments: [{ id: 1 }] },
        },
        // Sibling 2: deposit already collected with payments -> skipped
        {
          id: 102,
          reservationNo: "RSV-102",
          status: ReservationStatus.CONFIRMED,
          depositStatus: DepositStatus.COLLECTED,
          arrivalDate: TODAY,
          room: { number: "102" },
          folio: { payments: [{ id: 2 }] },
        },
        // Sibling 3: arrival in the future -> skipped
        {
          id: 103,
          reservationNo: "RSV-103",
          status: ReservationStatus.CONFIRMED,
          depositStatus: DepositStatus.PENDING,
          arrivalDate: FUTURE_DATE,
          room: { number: "103" },
          folio: { payments: [] },
        },
        // Sibling 4: eligible room -> succeeds
        {
          id: 104,
          reservationNo: "RSV-104",
          status: ReservationStatus.CONFIRMED,
          depositStatus: DepositStatus.PENDING,
          arrivalDate: TODAY,
          room: { number: "104" },
          folio: null,
        },
        // Sibling 5: eligible room -> fails with business domain error
        {
          id: 105,
          reservationNo: "RSV-105",
          status: ReservationStatus.CONFIRMED,
          depositStatus: DepositStatus.PENDING,
          arrivalDate: TODAY,
          room: { number: "105" },
          folio: null,
        },
        // Sibling 6: eligible room -> unexpected error during deposit collection
        {
          id: 106,
          reservationNo: "RSV-106",
          status: ReservationStatus.CONFIRMED,
          depositStatus: DepositStatus.PENDING,
          arrivalDate: TODAY,
          room: { number: "106" },
          folio: null,
        },
        // Sibling 7: eligible room after failed sibling -> succeeds
        {
          id: 107,
          reservationNo: "RSV-107",
          status: ReservationStatus.CONFIRMED,
          depositStatus: DepositStatus.PENDING,
          arrivalDate: TODAY,
          room: { number: "107" },
          folio: null,
        },
      ]);

      mocks.collectCheckInDepositForGroup
        .mockResolvedValueOnce({
          ok: true,
          payment: { amount: "350000", method: "CASH", reference: null },
          alreadyCollected: false,
        })
        .mockResolvedValueOnce({
          ok: false,
          code: "DEPOSIT_RATE_UNAVAILABLE",
          error: CHECK_IN_FAILURE_MESSAGES.DEPOSIT_RATE_UNAVAILABLE,
        })
        .mockRejectedValueOnce(new Error("Raw database connection deadlock timeout"))
        .mockResolvedValueOnce({
          ok: true,
          payment: { amount: "400000", method: "CASH", reference: null },
          alreadyCollected: false,
        });

      const result = await collectGroupDeposits({
        groupBookingId: "GRP-001",
        method: PaymentMethod.CASH,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.results).toHaveLength(7);

        // Room 101: skipped
        expect(result.results[0]).toEqual({
          reservationId: 101,
          reservationNo: "RSV-101",
          roomNumber: "101",
          status: "skipped",
          reason: "Sudah check-in.",
        });

        // Room 102: skipped
        expect(result.results[1]).toEqual({
          reservationId: 102,
          reservationNo: "RSV-102",
          roomNumber: "102",
          status: "skipped",
          reason: "Deposit sudah dikumpulkan.",
        });

        // Room 103: skipped
        expect(result.results[2]).toMatchObject({
          reservationId: 103,
          reservationNo: "RSV-103",
          roomNumber: "103",
          status: "skipped",
        });

        // Room 104: completed (before failed rooms)
        expect(result.results[3]).toEqual({
          reservationId: 104,
          reservationNo: "RSV-104",
          roomNumber: "104",
          status: "completed",
          reason: "Deposit 350000 dicatat pada folio kamar ini.",
        });

        // Room 105: failed with controlled error message (known business domain error)
        expect(result.results[4]).toEqual({
          reservationId: 105,
          reservationNo: "RSV-105",
          roomNumber: "105",
          status: "failed",
          reason: CHECK_IN_FAILURE_MESSAGES.DEPOSIT_RATE_UNAVAILABLE,
        });

        // Room 106: marked RESULT_UNKNOWN on unexpected throw without leaking raw exception message
        expect(result.results[5]).toEqual({
          reservationId: 106,
          reservationNo: "RSV-106",
          roomNumber: "106",
          status: "failed",
          reason: CHECK_IN_UNKNOWN_RESULT_MESSAGES.deposit,
        });
        expect(result.results[5].reason).not.toContain("deadlock");

        // Room 107: completed (after failed rooms)
        expect(result.results[6]).toEqual({
          reservationId: 107,
          reservationNo: "RSV-107",
          roomNumber: "107",
          status: "completed",
          reason: "Deposit 400000 dicatat pada folio kamar ini.",
        });
      }

      expect(mocks.revalidatePath).toHaveBeenCalledWith(
        "/app/fo/reservasi/grup/GRP-001",
      );
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/fo/reservasi/list");
    });

    it("rethrows framework control-flow errors from delegated calls in group deposit action", async () => {
      mocks.reservationFindMany.mockResolvedValueOnce([
        {
          id: 201,
          reservationNo: "RSV-201",
          status: ReservationStatus.CONFIRMED,
          depositStatus: DepositStatus.PENDING,
          arrivalDate: TODAY,
          room: { number: "201" },
          folio: null,
        },
      ]);

      const frameworkError = new Error("NEXT_REDIRECT");
      (frameworkError as unknown as { digest: string }).digest =
        "NEXT_REDIRECT;replace;/login;307;";
      mocks.collectCheckInDepositForGroup.mockRejectedValueOnce(frameworkError);

      await expect(
        collectGroupDeposits({
          groupBookingId: "GRP-001",
          method: PaymentMethod.CASH,
        }),
      ).rejects.toThrow("NEXT_REDIRECT");
    });

    it("defines the exact public wording for client transport rejection in GROUP_MUTATION_UNCERTAIN_MESSAGE", () => {
      expect(GROUP_MUTATION_UNCERTAIN_MESSAGE).toBe(
        "Hasil proses grup belum dapat dipastikan. Beberapa kamar mungkin sudah diproses. Muat ulang halaman sebelum mencoba lagi.",
      );
    });
  });
});
