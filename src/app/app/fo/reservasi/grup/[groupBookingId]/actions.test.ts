import { DepositStatus, PaymentMethod, ReservationStatus } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  reservationFindMany: vi.fn(),
  hotelSettingsFindUnique: vi.fn(),
  folioFindUnique: vi.fn(),
  computeFolioTotals: vi.fn(),
  recordFinalPayment: vi.fn(),
  completeCheckout: vi.fn(),
  collectCheckInDepositForGroup: vi.fn(),
  completeCheckIn: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    reservation: {
      findMany: mocks.reservationFindMany,
    },
    hotelSettings: {
      findUnique: mocks.hotelSettingsFindUnique,
    },
    folio: {
      findUnique: mocks.folioFindUnique,
    },
  },
}));
vi.mock("@/lib/check-in/actions", () => ({
  collectCheckInDepositForGroup: mocks.collectCheckInDepositForGroup,
  completeCheckIn: mocks.completeCheckIn,
}));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("@/components/check-in/signature-pad-field", () => ({
  SignaturePadField: () => null,
}));
vi.mock("@/lib/folio-totals", () => ({
  computeFolioTotals: mocks.computeFolioTotals,
}));
vi.mock("../../../check-out/[folioId]/actions", () => ({
  recordFinalPayment: mocks.recordFinalPayment,
  completeCheckout: mocks.completeCheckout,
}));

import {
  CHECK_IN_FAILURE_MESSAGES,
  CHECK_IN_UNKNOWN_RESULT_MESSAGES,
  GROUP_MUTATION_UNCERTAIN_MESSAGE,
} from "@/lib/check-in/errors";
import {
  CHECKOUT_FAILURE_MESSAGES,
  CHECKOUT_UNKNOWN_RESULT_MESSAGE,
  checkoutFailure,
  createMutationGuard,
  type MutationGuard,
} from "../../../check-out/[folioId]/errors";
import {
  checkoutEligibleGroupRooms,
  collectGroupDeposits,
  settleGroupBalances,
  type GroupActionResult,
} from "./actions";
import {
  acquireGroupMutationLease,
  batchSummaryText,
  GROUP_COMMITTED_RELOAD_MESSAGE,
  GROUP_RELOAD_BUTTON_LABEL,
  groupMutationRecoveryState,
  reloadGroupPage,
  beginGroupMutation,
  classifyGroupFinancialResults,
  groupMutationLeaseOwnsGuard,
  groupResultDetailText,
  latchGroupMutationCommitted,
  latchGroupMutationUncertain,
  releaseGroupMutationLease,
  resolvedGroupBatchOutcome,
  runGroupLeasedMutation,
  type GroupMutationOperation,
} from "./group-settlement-actions";

import { addDateOnlyDays, hotelTodayDateOnly } from "@/lib/date-only";

const TODAY = hotelTodayDateOnly();
const FUTURE_DATE = addDateOnlyDays(TODAY, 5);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function finalPaymentCalls() {
  return mocks.recordFinalPayment.mock.calls.map(([formData]) => ({
    folioId: formData.get("folioId"),
    amount: formData.get("amount"),
  }));
}

const STALE_SUMMARY = {
  title: "Ringkasan lama",
  results: [],
  variant: "settlement-checkout",
} as const;

const GROUP_OPERATIONS = [
  "deposit",
  "check-in",
  "settlement",
  "checkout",
] as const satisfies readonly GroupMutationOperation[];

const GROUP_OPERATION_LABELS: Record<
  GroupMutationOperation,
  { title: string; successLabel: string }
> = {
  deposit: {
    title: "Hasil pengumpulan deposit grup",
    successLabel: "dikumpulkan depositnya",
  },
  "check-in": {
    title: "Hasil check-in kamar siap",
    successLabel: "di-check-in",
  },
  settlement: {
    title: "Hasil pelunasan saldo grup",
    successLabel: "dilunasi",
  },
  checkout: {
    title: "Hasil check-out kamar siap",
    successLabel: "di-check-out",
  },
};

function groupEffectsProbe() {
  let batchResult: ReturnType<typeof resolvedGroupBatchOutcome>["batchResult"] = {
    ...STALE_SUMMARY,
    results: [],
  };
  let uncertaintyMessage: string | null = null;
  const success = vi.fn();
  const error = vi.fn();
  const refresh = vi.fn();

  return {
    get batchResult() {
      return batchResult;
    },
    get uncertaintyMessage() {
      return uncertaintyMessage;
    },
    effects: {
      clearBatchResult() {
        batchResult = null;
      },
      applyOutcome(outcome: ReturnType<typeof resolvedGroupBatchOutcome>) {
        batchResult = outcome.batchResult;
        uncertaintyMessage = outcome.uncertaintyMessage;
      },
      notifySuccess: success,
      notifyError: error,
      refresh,
    },
    success,
    error,
    refresh,
  };
}

function groupFinancialHarness() {
  const probe = groupEffectsProbe();

  return {
    guard: createMutationGuard(),
    get batchResult() {
      return probe.batchResult;
    },
    get uncertaintyMessage() {
      return probe.uncertaintyMessage;
    },
    effects: probe.effects,
    success: probe.success,
    error: probe.error,
    refresh: probe.refresh,
  };
}

// Mirrors exactly what every real group handler does: acquire the shared guard
// synchronously, then run the leased mutation inside the transition.
function runGroupOperation(
  guard: MutationGuard,
  operation: GroupMutationOperation,
  action: () => Promise<GroupActionResult>,
  effects: ReturnType<typeof groupEffectsProbe>["effects"],
): Promise<"applied" | "blocked" | "discarded"> {
  let run: Promise<"applied" | "discarded"> | null = null;

  const entry = beginGroupMutation(guard, operation, (lease) => {
    run = runGroupLeasedMutation(
      lease,
      action,
      GROUP_OPERATION_LABELS[operation],
      effects,
    );
  });

  if (entry === "blocked") return Promise.resolve("blocked" as const);
  return run!;
}

async function expectEveryGroupOperationBlocked(guard: MutationGuard) {
  for (const operation of GROUP_OPERATIONS) {
    const probe = groupEffectsProbe();
    const blockedAction = vi
      .fn<() => Promise<GroupActionResult>>()
      .mockResolvedValue({ ok: true, results: [] });

    await expect(
      runGroupOperation(guard, operation, blockedAction, probe.effects),
    ).resolves.toBe("blocked");

    expect(blockedAction).toHaveBeenCalledTimes(0);
    expect(probe.batchResult).toEqual(STALE_SUMMARY);
    expect(probe.uncertaintyMessage).toBeNull();
    expect(probe.success).not.toHaveBeenCalled();
    expect(probe.error).not.toHaveBeenCalled();
    expect(probe.refresh).not.toHaveBeenCalled();
  }
}

function completedRoom(reservationId: number) {
  return {
    reservationId,
    reservationNo: `RSV-${reservationId}`,
    roomNumber: String(reservationId),
    status: "completed" as const,
    reason: "Selesai.",
  };
}

function uncertainRoom(reservationId: number) {
  return {
    reservationId,
    reservationNo: `RSV-${reservationId}`,
    roomNumber: String(reservationId),
    status: "uncertain" as const,
    reason: CHECKOUT_UNKNOWN_RESULT_MESSAGE,
    code: "RESULT_UNKNOWN" as const,
  };
}

describe("group check-in and deposit actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({
      user: { id: "1", role: "FO" },
    });
    mocks.hotelSettingsFindUnique.mockResolvedValue({
      serviceChargePercent: 0,
      taxPercent: 0,
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

  describe("settleGroupBalances", () => {
    const settlementRooms = [
      {
        id: 301,
        reservationNo: "RSV-301",
        status: ReservationStatus.CHECKED_IN,
        room: { number: "301" },
        folio: { id: 31, status: "OPEN", lineItems: [], payments: [] },
      },
      {
        id: 302,
        reservationNo: "RSV-302",
        status: ReservationStatus.CHECKED_IN,
        room: { number: "302" },
        folio: { id: 32, status: "OPEN", lineItems: [], payments: [] },
      },
      {
        id: 303,
        reservationNo: "RSV-303",
        status: ReservationStatus.CHECKED_IN,
        room: { number: "303" },
        folio: { id: 33, status: "OPEN", lineItems: [], payments: [] },
      },
    ];

    it("preserves mixed known failure, uncertainty, and sibling success", async () => {
      mocks.reservationFindMany.mockResolvedValueOnce(settlementRooms);
      mocks.computeFolioTotals
        .mockReturnValueOnce({ balance: 100_000 })
        .mockReturnValueOnce({ balance: 100_000 })
        .mockReturnValueOnce({ balance: 100_000 })
        .mockReturnValueOnce({ balance: 0 });
      mocks.recordFinalPayment
        .mockResolvedValueOnce(checkoutFailure("PAYMENT_EXCEEDS_BALANCE"))
        .mockRejectedValueOnce(new Error("Prisma P2034 raw secret"))
        .mockResolvedValueOnce({ ok: true });
      mocks.folioFindUnique.mockResolvedValueOnce({
        id: 33,
        lineItems: [],
        payments: [],
      });

      const result = await settleGroupBalances({
        groupBookingId: "GRP-SETTLE",
        method: PaymentMethod.CASH,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.results).toEqual([
        {
          reservationId: 301,
          reservationNo: "RSV-301",
          roomNumber: "301",
          status: "failed",
          reason: CHECKOUT_FAILURE_MESSAGES.PAYMENT_EXCEEDS_BALANCE,
          code: "PAYMENT_EXCEEDS_BALANCE",
        },
        {
          reservationId: 302,
          reservationNo: "RSV-302",
          roomNumber: "302",
          status: "uncertain",
          reason: CHECKOUT_UNKNOWN_RESULT_MESSAGE,
          code: "RESULT_UNKNOWN",
        },
        {
          reservationId: 303,
          reservationNo: "RSV-303",
          roomNumber: "303",
          status: "completed",
          reason: "Saldo folio dilunasi.",
          details: [
            {
              label: "Pembayaran awal",
              status: "completed",
              reason: "Pembayaran Rp 100.000 berhasil dicatat.",
            },
          ],
        },
      ]);
      expect(result.results[1].reason).not.toContain("P2034");
      expect(mocks.recordFinalPayment).toHaveBeenCalledTimes(3);
    });

    it.each(["throw", "null"] as const)(
      "preserves the first confirmed payment when its follow-up read returns %s and continues safely",
      async (readFailure) => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        mocks.reservationFindMany.mockResolvedValueOnce(settlementRooms.slice(0, 2));
        mocks.computeFolioTotals
          .mockReturnValueOnce({ balance: 100_000 })
          .mockReturnValueOnce({ balance: 100_000 })
          .mockReturnValueOnce({ balance: 0 });
        mocks.recordFinalPayment
          .mockResolvedValueOnce({ ok: true })
          .mockResolvedValueOnce({ ok: true });
        if (readFailure === "throw") {
          mocks.folioFindUnique.mockRejectedValueOnce(
            new Error("raw post-payment Prisma secret"),
          );
        } else {
          mocks.folioFindUnique.mockResolvedValueOnce(null);
        }
        mocks.folioFindUnique.mockResolvedValueOnce({
          id: 32,
          lineItems: [],
          payments: [],
        });

        const result = await settleGroupBalances({
          groupBookingId: "GRP-SETTLE",
          method: PaymentMethod.CASH,
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.results[0]).toMatchObject({
          reservationId: 301,
          reservationNo: "RSV-301",
          roomNumber: "301",
          status: "uncertain",
          code: "RESULT_UNKNOWN",
          details: [
            {
              label: "Pembayaran awal",
              status: "completed",
            },
          ],
        });
        expect(result.results[0].reason).toContain(
          "Pembayaran berhasil dicatat, tetapi status pelunasan akhir belum dapat dipastikan.",
        );
        expect(result.results[0].reason).toContain("Muat ulang halaman");
        expect(result.results[0].reason).not.toContain("Prisma");
        expect(result.results[0].details?.[0].reason).not.toContain("secret");
        expect(result.results[1]).toMatchObject({
          reservationId: 302,
          reservationNo: "RSV-302",
          roomNumber: "302",
          status: "completed",
        });
        expect(finalPaymentCalls()).toEqual([
          { folioId: "31", amount: "100000" },
          { folioId: "32", amount: "100000" },
        ]);
      },
    );

    it.each(["throw", "null"] as const)(
      "preserves both confirmed payments when the final read returns %s and continues safely",
      async (readFailure) => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        mocks.reservationFindMany.mockResolvedValueOnce(settlementRooms.slice(0, 2));
        mocks.computeFolioTotals
          .mockReturnValueOnce({ balance: 100_000 })
          .mockReturnValueOnce({ balance: 50_000 })
          .mockReturnValueOnce({ balance: 100_000 })
          .mockReturnValueOnce({ balance: 0 });
        mocks.recordFinalPayment
          .mockResolvedValueOnce({ ok: true })
          .mockResolvedValueOnce({ ok: true })
          .mockResolvedValueOnce({ ok: true });
        mocks.folioFindUnique.mockResolvedValueOnce({
          id: 31,
          lineItems: [],
          payments: [],
        });
        if (readFailure === "throw") {
          mocks.folioFindUnique.mockRejectedValueOnce(
            new Error("raw final-read Prisma secret"),
          );
        } else {
          mocks.folioFindUnique.mockResolvedValueOnce(null);
        }
        mocks.folioFindUnique.mockResolvedValueOnce({
          id: 32,
          lineItems: [],
          payments: [],
        });

        const result = await settleGroupBalances({
          groupBookingId: "GRP-SETTLE",
          method: PaymentMethod.CASH,
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.results[0]).toMatchObject({
          reservationId: 301,
          reservationNo: "RSV-301",
          roomNumber: "301",
          status: "uncertain",
          code: "RESULT_UNKNOWN",
          details: [
            { label: "Pembayaran awal", status: "completed" },
            { label: "Pembayaran tambahan", status: "completed" },
          ],
        });
        expect(result.results[0].reason).toContain(
          "Pembayaran berhasil dicatat, tetapi status pelunasan akhir belum dapat dipastikan.",
        );
        expect(result.results[0].reason).not.toContain("Prisma");
        expect(result.results[1]).toMatchObject({
          reservationId: 302,
          reservationNo: "RSV-302",
          roomNumber: "302",
          status: "completed",
        });
        expect(finalPaymentCalls()).toEqual([
          { folioId: "31", amount: "100000" },
          { folioId: "31", amount: "50000" },
          { folioId: "32", amount: "100000" },
        ]);
      },
    );

    it("preserves both confirmed payments and the authoritative positive final balance", async () => {
      mocks.reservationFindMany.mockResolvedValueOnce(settlementRooms.slice(0, 1));
      mocks.computeFolioTotals
        .mockReturnValueOnce({ balance: 100_000 })
        .mockReturnValueOnce({ balance: 50_000 })
        .mockReturnValueOnce({ balance: 25_000 });
      mocks.recordFinalPayment
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: true });
      mocks.folioFindUnique
        .mockResolvedValueOnce({ id: 31, lineItems: [], payments: [] })
        .mockResolvedValueOnce({ id: 31, lineItems: [], payments: [] });

      const result = await settleGroupBalances({
        groupBookingId: "GRP-SETTLE",
        method: PaymentMethod.CASH,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.results[0]).toMatchObject({
        reservationId: 301,
        reservationNo: "RSV-301",
        roomNumber: "301",
        status: "failed",
        details: [
          { label: "Pembayaran awal", status: "completed" },
          { label: "Pembayaran tambahan", status: "completed" },
        ],
      });
      expect(result.results[0].reason).toContain("Sisa Tagihan masih Rp 25.000");
      expect(result.results[0].reason).toContain("Muat ulang halaman");
      expect(finalPaymentCalls()).toEqual([
        { folioId: "31", amount: "100000" },
        { folioId: "31", amount: "50000" },
      ]);
    });

    it("returns controlled authorization and validation failures", async () => {
      mocks.auth.mockResolvedValueOnce(null);
      await expect(
        settleGroupBalances({
          groupBookingId: "GRP-SETTLE",
          method: PaymentMethod.CASH,
        }),
      ).resolves.toEqual(checkoutFailure("SESSION_EXPIRED"));

      await expect(
        settleGroupBalances({
          groupBookingId: " ",
          method: PaymentMethod.CASH,
        }),
      ).resolves.toEqual(checkoutFailure("INVALID_INPUT"));
    });
  });

  describe("checkoutEligibleGroupRooms", () => {
    it("preserves a known failure, marks a thrown call uncertain, and continues siblings", async () => {
      mocks.reservationFindMany.mockResolvedValueOnce([
        ...[401, 402, 403].map((id) => ({
          id,
          reservationNo: `RSV-${id}`,
          status: ReservationStatus.CHECKED_IN,
          departureDate: TODAY,
          room: { number: String(id) },
          folio: { id, status: "OPEN", lineItems: [], payments: [] },
        })),
      ]);
      mocks.computeFolioTotals.mockReturnValue({ balance: 0 });
      mocks.completeCheckout
        .mockResolvedValueOnce(checkoutFailure("BALANCE_DUE", { amount: "Rp 50.000" }))
        .mockRejectedValueOnce(new Error("raw checkout timeout secret"))
        .mockResolvedValueOnce({ ok: true });

      const result = await checkoutEligibleGroupRooms("GRP-CHECKOUT");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.results.map(({ status, code }) => ({ status, code }))).toEqual([
        { status: "failed", code: "BALANCE_DUE" },
        { status: "uncertain", code: "RESULT_UNKNOWN" },
        { status: "completed", code: undefined },
      ]);
      expect(result.results[0].reason).toContain("Rp 50.000");
      expect(result.results[1].reason).toBe(CHECKOUT_UNKNOWN_RESULT_MESSAGE);
      expect(result.results[1].reason).not.toContain("secret");
      expect(mocks.completeCheckout).toHaveBeenCalledTimes(3);
    });
  });

  describe("group client orchestration", () => {
    it.each(GROUP_OPERATIONS)(
      "gives a pending %s exclusive ownership of the shared group guard",
      async (firstOperation) => {
        const pending = deferred<GroupActionResult>();
        const firstAction = vi.fn(() => pending.promise);
        const harness = groupFinancialHarness();

        const first = runGroupOperation(
          harness.guard,
          firstOperation,
          firstAction,
          harness.effects,
        );

        expect(firstAction).toHaveBeenCalledOnce();
        expect(harness.guard.state).toBe("in-flight");

        await expectEveryGroupOperationBlocked(harness.guard);

        expect(firstAction).toHaveBeenCalledOnce();
        expect(harness.guard.state).toBe("in-flight");

        pending.resolve({ ok: true, results: [] });
        await expect(first).resolves.toBe("applied");
        expect(harness.guard.state).toBe("idle");
        expect(harness.refresh).toHaveBeenCalledOnce();
      },
    );

    it.each([
      ["settlement", "checkout"],
      ["checkout", "settlement"],
    ] as const)(
      "synchronously excludes %s and then %s while the first call is pending",
      async (firstOperation, secondOperation) => {
        const pending = deferred<GroupActionResult>();
        const firstAction = vi.fn(() => pending.promise);
        const secondAction = vi
          .fn<() => Promise<GroupActionResult>>()
          .mockResolvedValue({ ok: true, results: [] });
        const harness = groupFinancialHarness();

        const first = runGroupOperation(
          harness.guard,
          firstOperation,
          firstAction,
          harness.effects,
        );
        const second = runGroupOperation(
          harness.guard,
          secondOperation,
          secondAction,
          harness.effects,
        );

        expect(firstAction).toHaveBeenCalledOnce();
        expect(secondAction).not.toHaveBeenCalled();
        await expect(second).resolves.toBe("blocked");
        pending.resolve({ ok: true, results: [] });
        await expect(first).resolves.toBe("applied");
        expect(harness.guard.state).toBe("idle");
        expect(harness.refresh).toHaveBeenCalledOnce();
      },
    );

    it.each(["settlement", "checkout"] as const)(
      "clears stale state and permanently latches whole-call %s uncertainty",
      async (operation) => {
        const pending = deferred<GroupActionResult>();
        const action = vi.fn(() => pending.promise);
        const harness = groupFinancialHarness();
        const first = runGroupOperation(
          harness.guard,
          operation,
          action,
          harness.effects,
        );

        expect(harness.batchResult).toBeNull();
        pending.reject(new Error(`raw ${operation} transport secret`));
        await expect(first).resolves.toBe("applied");

        expect(harness.guard.state).toBe("uncertain");
        expect(harness.batchResult).toBeNull();
        expect(harness.uncertaintyMessage).toBe(
          GROUP_MUTATION_UNCERTAIN_MESSAGE,
        );
        expect(harness.success).not.toHaveBeenCalled();
        expect(harness.error).not.toHaveBeenCalled();
        expect(harness.refresh).not.toHaveBeenCalled();

        const laterSuccess = vi
          .fn<() => Promise<GroupActionResult>>()
          .mockResolvedValue({ ok: true, results: [] });
        const laterFailure = vi
          .fn<() => Promise<GroupActionResult>>()
          .mockResolvedValue(checkoutFailure("CHECKOUT_CONFLICT"));
        await expect(
          runGroupOperation(
            harness.guard,
            "settlement",
            laterSuccess,
            harness.effects,
          ),
        ).resolves.toBe("blocked");
        await expect(
          runGroupOperation(
            harness.guard,
            "checkout",
            laterFailure,
            harness.effects,
          ),
        ).resolves.toBe("blocked");

        expect(laterSuccess).not.toHaveBeenCalled();
        expect(laterFailure).not.toHaveBeenCalled();
        expect(harness.batchResult).toBeNull();
        expect(harness.uncertaintyMessage).toBe(
          GROUP_MUTATION_UNCERTAIN_MESSAGE,
        );
        expect(harness.success).not.toHaveBeenCalled();
        expect(harness.error).not.toHaveBeenCalled();
        expect(harness.refresh).not.toHaveBeenCalled();

        await expectEveryGroupOperationBlocked(harness.guard);
      },
    );

    it("latches a returned reload-required result and ignores local state changes", async () => {
      const harness = groupFinancialHarness();
      const localState = { dialogOpen: true, reference: "baru" };
      const reloadRequiredRoom = uncertainRoom(301);

      await expect(
        runGroupOperation(
          harness.guard,
          "settlement",
          async () => ({ ok: true, results: [reloadRequiredRoom] }),
          harness.effects,
        ),
      ).resolves.toBe("applied");

      localState.dialogOpen = false;
      localState.reference = "diubah";
      expect(localState).toEqual({ dialogOpen: false, reference: "diubah" });
      expect(harness.guard.state).toBe("uncertain");
      expect(harness.batchResult?.results).toEqual([reloadRequiredRoom]);
      expect(harness.uncertaintyMessage).toBe(GROUP_MUTATION_UNCERTAIN_MESSAGE);
      expect(harness.success).not.toHaveBeenCalled();
      expect(harness.error).not.toHaveBeenCalled();
      expect(harness.refresh).not.toHaveBeenCalled();
    });

    it("keeps confirmed partial payment details visible and locks further mutations", () => {
      const details = [
        {
          label: "Pembayaran awal",
          status: "completed" as const,
          reason: "Pembayaran Rp 100.000 berhasil dicatat.",
        },
        {
          label: "Pembayaran tambahan",
          status: "completed" as const,
          reason: "Pembayaran Rp 50.000 berhasil dicatat.",
        },
      ];
      const outcome = resolvedGroupBatchOutcome(
        "Hasil pelunasan",
        [
          {
            reservationId: 301,
            reservationNo: "RSV-301",
            roomNumber: "301",
            status: "uncertain",
            reason:
              "Pembayaran berhasil dicatat, tetapi status pelunasan akhir belum dapat dipastikan. Muat ulang halaman sebelum melakukan pembayaran atau check-out lagi.",
            code: "RESULT_UNKNOWN",
            details,
          },
        ],
        "dilunasi",
        "settlement-checkout",
      );

      expect(outcome.batchResult?.results[0].details).toEqual(details);
      expect(details.map(groupResultDetailText)).toEqual([
        "Pembayaran awal: Selesai — Pembayaran Rp 100.000 berhasil dicatat.",
        "Pembayaran tambahan: Selesai — Pembayaran Rp 50.000 berhasil dicatat.",
      ]);
      expect(outcome.uncertaintyMessage).toBe(GROUP_MUTATION_UNCERTAIN_MESSAGE);
    });

    it.each([
      ["settlement", "checkout"],
      ["checkout", "settlement"],
      ["settlement", "settlement"],
      ["checkout", "checkout"],
    ] as const)(
      "keeps confirmed %s work committed and blocks a later %s",
      async (firstOperation, secondOperation) => {
        const harness = groupFinancialHarness();
        const committed = completedRoom(501);
        const firstAction = vi
          .fn<() => Promise<GroupActionResult>>()
          .mockResolvedValue({ ok: true, results: [committed] });
        const secondAction = vi
          .fn<() => Promise<GroupActionResult>>()
          .mockResolvedValue({ ok: true, results: [committed] });

        await expect(
          runGroupOperation(
            harness.guard,
            firstOperation,
            firstAction,
            harness.effects,
          ),
        ).resolves.toBe("applied");

        expect(harness.guard.state).toBe("committed");
        expect(harness.batchResult?.results).toEqual([committed]);
        expect(harness.success).toHaveBeenCalledOnce();
        expect(harness.refresh).toHaveBeenCalledOnce();
        expect(firstAction).toHaveBeenCalledTimes(1);

        await expect(
          runGroupOperation(
            harness.guard,
            secondOperation,
            secondAction,
            harness.effects,
          ),
        ).resolves.toBe("blocked");
        expect(secondAction).toHaveBeenCalledTimes(0);
        expect(firstAction).toHaveBeenCalledTimes(1);
        expect(harness.success).toHaveBeenCalledOnce();
        expect(harness.refresh).toHaveBeenCalledOnce();

        await expectEveryGroupOperationBlocked(harness.guard);
      },
    );

    it("classifies retained completed payment details as committed", async () => {
      const harness = groupFinancialHarness();
      const failedAfterPayment = {
        reservationId: 502,
        reservationNo: "RSV-502",
        roomNumber: "502",
        status: "failed" as const,
        reason: "Sisa Tagihan berubah.",
        details: [
          {
            label: "Pembayaran awal",
            status: "completed" as const,
            reason: "Pembayaran Rp 100.000 berhasil dicatat.",
          },
        ],
      };

      expect(classifyGroupFinancialResults([failedAfterPayment])).toBe(
        "committed",
      );
      await runGroupOperation(
        harness.guard,
        "settlement",
        async () => ({ ok: true, results: [failedAfterPayment] }),
        harness.effects,
      );

      expect(harness.guard.state).toBe("committed");
      expect(harness.batchResult?.results[0].details).toEqual(
        failedAfterPayment.details,
      );
    });

    it("gives uncertainty precedence over committed work in a mixed batch", async () => {
      const harness = groupFinancialHarness();
      const results = [completedRoom(503), uncertainRoom(504)];

      expect(classifyGroupFinancialResults(results)).toBe("uncertain");
      await runGroupOperation(
        harness.guard,
        "settlement",
        async () => ({ ok: true, results }),
        harness.effects,
      );

      expect(harness.guard.state).toBe("uncertain");
      expect(harness.batchResult?.results).toEqual(results);
      expect(harness.uncertaintyMessage).toBe(GROUP_MUTATION_UNCERTAIN_MESSAGE);
      expect(harness.success).not.toHaveBeenCalled();
      expect(harness.error).not.toHaveBeenCalled();
      expect(harness.refresh).not.toHaveBeenCalled();
    });

    it("releases a completely known no-write failure for corrected resubmission", async () => {
      const harness = groupFinancialHarness();

      await expect(
        runGroupOperation(
          harness.guard,
          "settlement",
          async () => checkoutFailure("INVALID_INPUT"),
          harness.effects,
        ),
      ).resolves.toBe("applied");

      expect(harness.guard.state).toBe("idle");
      expect(harness.error).toHaveBeenCalledWith(
        CHECKOUT_FAILURE_MESSAGES.INVALID_INPUT,
      );
      expect(harness.success).not.toHaveBeenCalled();
    });

    it("contains notification failure, keeps committed, and still refreshes", async () => {
      const harness = groupFinancialHarness();
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      harness.success.mockImplementation(() => {
        throw new Error("group toast raw secret");
      });

      await expect(
        runGroupOperation(
          harness.guard,
          "settlement",
          async () => ({ ok: true, results: [completedRoom(505)] }),
          harness.effects,
        ),
      ).resolves.toBe("applied");

      expect(harness.guard.state).toBe("committed");
      expect(harness.refresh).toHaveBeenCalledOnce();
      expect(harness.error).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith(
        "[GroupFinancialClient] Follow-up failed",
        { sideEffect: "success-notification" },
      );
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
        "group toast raw secret",
      );
    });

    it("contains refresh and outcome-rendering failures without unlocking committed work", async () => {
      const harness = groupFinancialHarness();
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      harness.effects.applyOutcome = vi.fn(() => {
        throw new Error("render raw secret");
      });
      harness.refresh.mockImplementation(() => {
        throw new Error("refresh raw secret");
      });

      await expect(
        runGroupOperation(
          harness.guard,
          "checkout",
          async () => ({ ok: true, results: [completedRoom(506)] }),
          harness.effects,
        ),
      ).resolves.toBe("applied");

      expect(harness.guard.state).toBe("committed");
      expect(harness.success).toHaveBeenCalledOnce();
      expect(harness.error).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith(
        "[GroupFinancialClient] Follow-up failed",
        { sideEffect: "outcome-rendering" },
      );
      expect(consoleError).toHaveBeenCalledWith(
        "[GroupFinancialClient] Follow-up failed",
        { sideEffect: "refresh" },
      );
      expect(JSON.stringify(consoleError.mock.calls)).not.toMatch(
        /render raw secret|refresh raw secret/,
      );
    });

    it.each([
      ["deposit", "committed"],
      ["deposit", "uncertain"],
      ["check-in", "committed"],
      ["check-in", "uncertain"],
    ] as const)(
      "blocks %s synchronously from a stale render when the shared guard is %s",
      (operation, terminalState) => {
        const guard = createMutationGuard();
        const owner = acquireGroupMutationLease(guard, "settlement");
        expect(owner).not.toBeNull();
        if (terminalState === "committed") latchGroupMutationCommitted(owner!);
        else latchGroupMutationUncertain(owner!);

        const staleRenderedWarning: string | null = null;
        const existingResult = { title: "Hasil sebelumnya" };
        let currentResult = existingResult;
        let currentWarning: string | null = staleRenderedWarning;
        const serverAction = vi.fn();

        const entry = beginGroupMutation(guard, operation, () => {
          currentResult = { title: `Hasil ${operation}` };
          currentWarning = "Pesan baru";
          serverAction();
        });

        expect(entry).toBe("blocked");
        expect(serverAction).not.toHaveBeenCalled();
        expect(currentResult).toBe(existingResult);
        expect(currentWarning).toBeNull();
        expect(guard.state).toBe(terminalState);
      },
    );

    it.each(["deposit", "check-in"] as const)(
      "blocks %s while settlement or checkout is synchronously in flight",
      (operation) => {
        const guard = createMutationGuard();
        expect(acquireGroupMutationLease(guard, "checkout")).not.toBeNull();
        const serverAction = vi.fn().mockName(operation);

        expect(beginGroupMutation(guard, operation, serverAction)).toBe(
          "blocked",
        );
        expect(serverAction).not.toHaveBeenCalled();
        expect(guard.state).toBe("in-flight");
      },
    );

    it.each(["deposit", "check-in"] as const)(
      "keeps a confirmed %s committed and blocks every later group mutation",
      async (operation) => {
        const harness = groupFinancialHarness();
        const action = vi
          .fn<() => Promise<GroupActionResult>>()
          .mockResolvedValue({ ok: true, results: [completedRoom(601)] });

        await expect(
          runGroupOperation(harness.guard, operation, action, harness.effects),
        ).resolves.toBe("applied");

        expect(action).toHaveBeenCalledTimes(1);
        expect(harness.guard.state).toBe("committed");
        // Batch 2B presentation: completed rooms stay out of the summary list.
        expect(harness.batchResult).toBeNull();
        expect(harness.uncertaintyMessage).toBeNull();
        expect(harness.success).toHaveBeenCalledWith(
          `1 kamar berhasil ${GROUP_OPERATION_LABELS[operation].successLabel}.`,
        );
        expect(harness.error).not.toHaveBeenCalled();
        expect(harness.refresh).toHaveBeenCalledOnce();

        await expectEveryGroupOperationBlocked(harness.guard);
      },
    );

    it.each(["deposit", "check-in"] as const)(
      "latches a per-room %s uncertainty and blocks every later group mutation",
      async (operation) => {
        const harness = groupFinancialHarness();
        const results = [uncertainRoom(602)];
        const action = vi
          .fn<() => Promise<GroupActionResult>>()
          .mockResolvedValue({ ok: true, results });

        await expect(
          runGroupOperation(harness.guard, operation, action, harness.effects),
        ).resolves.toBe("applied");

        expect(harness.guard.state).toBe("uncertain");
        expect(harness.batchResult?.results).toEqual(results);
        expect(harness.uncertaintyMessage).toBe(
          GROUP_MUTATION_UNCERTAIN_MESSAGE,
        );
        expect(harness.success).not.toHaveBeenCalled();
        expect(harness.error).not.toHaveBeenCalled();
        // Batch 2B best-effort refresh, restored: it runs through the
        // contained effect wrapper and cannot unlock the latch.
        expect(harness.refresh).toHaveBeenCalledOnce();

        await expectEveryGroupOperationBlocked(harness.guard);
      },
    );

    it.each(["deposit", "check-in"] as const)(
      "gives uncertainty priority over completed rooms in a mixed %s batch",
      async (operation) => {
        const harness = groupFinancialHarness();
        const results = [completedRoom(603), uncertainRoom(604)];

        expect(classifyGroupFinancialResults(results)).toBe("uncertain");
        await expect(
          runGroupOperation(
            harness.guard,
            operation,
            async () => ({ ok: true, results }),
            harness.effects,
          ),
        ).resolves.toBe("applied");

        expect(harness.guard.state).toBe("uncertain");
        expect(harness.uncertaintyMessage).toBe(
          GROUP_MUTATION_UNCERTAIN_MESSAGE,
        );
        expect(harness.success).not.toHaveBeenCalled();
        // Batch 2B best-effort refresh, restored: it runs through the
        // contained effect wrapper and cannot unlock the latch.
        expect(harness.refresh).toHaveBeenCalledOnce();

        await expectEveryGroupOperationBlocked(harness.guard);
      },
    );

    it.each(["deposit", "check-in"] as const)(
      "latches whole-call %s rejection as uncertain without leaking the raw error",
      async (operation) => {
        const harness = groupFinancialHarness();
        const pending = deferred<GroupActionResult>();
        const run = runGroupOperation(
          harness.guard,
          operation,
          () => pending.promise,
          harness.effects,
        );

        expect(harness.batchResult).toBeNull();
        pending.reject(new Error(`raw ${operation} transport secret`));
        await expect(run).resolves.toBe("applied");

        expect(harness.guard.state).toBe("uncertain");
        expect(harness.batchResult).toBeNull();
        expect(harness.uncertaintyMessage).toBe(
          GROUP_MUTATION_UNCERTAIN_MESSAGE,
        );
        expect(harness.uncertaintyMessage).not.toContain("raw");
        expect(harness.success).not.toHaveBeenCalled();
        expect(harness.error).not.toHaveBeenCalled();
        // Batch 2B best-effort refresh, restored: it runs through the
        // contained effect wrapper and cannot unlock the latch.
        expect(harness.refresh).toHaveBeenCalledOnce();

        await expectEveryGroupOperationBlocked(harness.guard);
      },
    );

    it.each(["deposit", "check-in"] as const)(
      "releases an entirely known no-write %s result for retry",
      async (operation) => {
        const harness = groupFinancialHarness();
        const results = [
          {
            reservationId: 605,
            reservationNo: "RSV-605",
            roomNumber: "605",
            status: "skipped" as const,
            reason: "Dilewati.",
          },
          {
            reservationId: 606,
            reservationNo: "RSV-606",
            roomNumber: "606",
            status: "failed" as const,
            reason: CHECK_IN_FAILURE_MESSAGES.RESERVATION_NOT_ELIGIBLE,
          },
        ];

        expect(classifyGroupFinancialResults(results)).toBe("known-no-write");
        await expect(
          runGroupOperation(
            harness.guard,
            operation,
            async () => ({ ok: true, results }),
            harness.effects,
          ),
        ).resolves.toBe("applied");

        expect(harness.guard.state).toBe("idle");
        expect(harness.uncertaintyMessage).toBeNull();
        expect(harness.success).not.toHaveBeenCalled();
        expect(harness.batchResult && batchSummaryText(harness.batchResult)).toBe(
          "1 dilewati · 1 gagal",
        );

        const retry = vi
          .fn<() => Promise<GroupActionResult>>()
          .mockResolvedValue({ ok: true, results: [] });
        await expect(
          runGroupOperation(harness.guard, operation, retry, harness.effects),
        ).resolves.toBe("applied");
        expect(retry).toHaveBeenCalledTimes(1);
      },
    );

    it.each(["deposit", "check-in"] as const)(
      "releases a rejected whole %s call for corrected resubmission",
      async (operation) => {
        const harness = groupFinancialHarness();

        await expect(
          runGroupOperation(
            harness.guard,
            operation,
            async () => checkoutFailure("INVALID_INPUT"),
            harness.effects,
          ),
        ).resolves.toBe("applied");

        expect(harness.guard.state).toBe("idle");
        expect(harness.error).toHaveBeenCalledWith(
          CHECKOUT_FAILURE_MESSAGES.INVALID_INPUT,
        );
        expect(harness.success).not.toHaveBeenCalled();
        expect(harness.refresh).toHaveBeenCalledOnce();
      },
    );

    it.each(["deposit", "check-in"] as const)(
      "keeps confirmed %s work committed when its toast throws and still refreshes",
      async (operation) => {
        const harness = groupFinancialHarness();
        const consoleError = vi
          .spyOn(console, "error")
          .mockImplementation(() => undefined);
        harness.success.mockImplementation(() => {
          throw new Error(`${operation} toast raw secret`);
        });

        await expect(
          runGroupOperation(
            harness.guard,
            operation,
            async () => ({ ok: true, results: [completedRoom(607)] }),
            harness.effects,
          ),
        ).resolves.toBe("applied");

        expect(harness.guard.state).toBe("committed");
        expect(harness.uncertaintyMessage).toBeNull();
        expect(harness.refresh).toHaveBeenCalledOnce();
        expect(consoleError).toHaveBeenCalledWith(
          "[GroupFinancialClient] Follow-up failed",
          { sideEffect: "success-notification" },
        );
        expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
          "toast raw secret",
        );

        await expectEveryGroupOperationBlocked(harness.guard);
      },
    );

    it.each(["deposit", "check-in"] as const)(
      "keeps confirmed %s work committed when rendering and refresh throw",
      async (operation) => {
        const harness = groupFinancialHarness();
        const consoleError = vi
          .spyOn(console, "error")
          .mockImplementation(() => undefined);
        harness.effects.applyOutcome = vi.fn(() => {
          throw new Error("render raw secret");
        });
        harness.refresh.mockImplementation(() => {
          throw new Error("refresh raw secret");
        });

        await expect(
          runGroupOperation(
            harness.guard,
            operation,
            async () => ({ ok: true, results: [completedRoom(608)] }),
            harness.effects,
          ),
        ).resolves.toBe("applied");

        expect(harness.guard.state).toBe("committed");
        expect(harness.success).toHaveBeenCalledOnce();
        expect(consoleError).toHaveBeenCalledWith(
          "[GroupFinancialClient] Follow-up failed",
          { sideEffect: "outcome-rendering" },
        );
        expect(consoleError).toHaveBeenCalledWith(
          "[GroupFinancialClient] Follow-up failed",
          { sideEffect: "refresh" },
        );
        expect(JSON.stringify(consoleError.mock.calls)).not.toMatch(
          /render raw secret|refresh raw secret/,
        );

        await expectEveryGroupOperationBlocked(harness.guard);
      },
    );

    describe("shared guard ownership", () => {
      it("refuses a second lease while the guard is owned", () => {
        const guard = createMutationGuard();
        const owner = acquireGroupMutationLease(guard, "deposit");

        expect(owner).not.toBeNull();
        expect(groupMutationLeaseOwnsGuard(owner!)).toBe(true);
        expect(guard.state).toBe("in-flight");
        expect(acquireGroupMutationLease(guard, "settlement")).toBeNull();
        expect(guard.state).toBe("in-flight");
      });

      it("lets only the owning lease settle the guard", () => {
        const guard = createMutationGuard();
        const owner = acquireGroupMutationLease(guard, "check-in")!;
        const forged = { operation: "checkout" as const, guard };

        expect(groupMutationLeaseOwnsGuard(forged)).toBe(false);
        expect(latchGroupMutationUncertain(forged)).toBe(false);
        expect(latchGroupMutationCommitted(forged)).toBe(false);
        expect(releaseGroupMutationLease(forged)).toBe(false);
        expect(guard.state).toBe("in-flight");

        expect(latchGroupMutationCommitted(owner)).toBe(true);
        expect(guard.state).toBe("committed");
        expect(groupMutationLeaseOwnsGuard(owner)).toBe(false);
        expect(releaseGroupMutationLease(owner)).toBe(false);
        expect(guard.state).toBe("committed");
      });

      it("stops a stale lease from altering a newer operation", () => {
        const guard = createMutationGuard();
        const stale = acquireGroupMutationLease(guard, "deposit")!;

        expect(releaseGroupMutationLease(stale)).toBe(true);
        expect(guard.state).toBe("idle");

        const current = acquireGroupMutationLease(guard, "settlement")!;
        expect(groupMutationLeaseOwnsGuard(stale)).toBe(false);
        expect(latchGroupMutationUncertain(stale)).toBe(false);
        expect(releaseGroupMutationLease(stale)).toBe(false);
        expect(guard.state).toBe("in-flight");

        expect(latchGroupMutationUncertain(current)).toBe(true);
        expect(guard.state).toBe("uncertain");
      });

      it("applies the owning operation's result while the guard is in-flight", async () => {
        const harness = groupFinancialHarness();
        const pending = deferred<GroupActionResult>();
        let observedOwnership: boolean | null = null;

        let run: Promise<"applied" | "discarded"> | null = null;
        const entry = beginGroupMutation(harness.guard, "deposit", (lease) => {
          observedOwnership = groupMutationLeaseOwnsGuard(lease);
          run = runGroupLeasedMutation(
            lease,
            () => pending.promise,
            GROUP_OPERATION_LABELS.deposit,
            harness.effects,
          );
        });

        expect(entry).toBe("started");
        expect(observedOwnership).toBe(true);
        expect(harness.guard.state).toBe("in-flight");

        pending.resolve({ ok: true, results: [completedRoom(609)] });
        await expect(run!).resolves.toBe("applied");

        expect(harness.guard.state).toBe("committed");
        expect(harness.success).toHaveBeenCalledOnce();
      });
    });


    describe("terminal-state recovery and effect containment", () => {
      it.each(GROUP_OPERATIONS)(
        "offers the committed reload notice after a successful %s",
        async (operation) => {
          const harness = groupFinancialHarness();

          await expect(
            runGroupOperation(
              harness.guard,
              operation,
              async () => ({ ok: true, results: [completedRoom(701)] }),
              harness.effects,
            ),
          ).resolves.toBe("applied");

          expect(harness.guard.state).toBe("committed");

          const recovery = groupMutationRecoveryState("committed");
          expect(recovery.showCommittedNotice).toBe(true);
          expect(recovery.isMutationLocked).toBe(true);
          // Committed success must never be presented as uncertainty.
          expect(recovery.showUncertaintyNotice).toBe(false);
          expect(harness.uncertaintyMessage).toBeNull();
          expect(GROUP_COMMITTED_RELOAD_MESSAGE).toBe(
            "Tindakan berhasil diproses. Muat ulang halaman untuk melanjutkan dengan data terbaru.",
          );
          expect(GROUP_RELOAD_BUTTON_LABEL).toBe("Muat ulang halaman");

          // All four mutations stay locked until a real reload.
          await expectEveryGroupOperationBlocked(harness.guard);
        },
      );

      it("keeps the committed notice distinct from the uncertainty notice", () => {
        expect(groupMutationRecoveryState("committed")).toEqual({
          showCommittedNotice: true,
          showUncertaintyNotice: false,
          isMutationLocked: true,
        });
        expect(groupMutationRecoveryState("uncertain")).toEqual({
          showCommittedNotice: false,
          showUncertaintyNotice: true,
          isMutationLocked: true,
        });
        expect(groupMutationRecoveryState(null)).toEqual({
          showCommittedNotice: false,
          showUncertaintyNotice: false,
          isMutationLocked: false,
        });
        expect(GROUP_COMMITTED_RELOAD_MESSAGE).not.toBe(
          GROUP_MUTATION_UNCERTAIN_MESSAGE,
        );
      });

      it("performs a real page reload from the committed notice", () => {
        const reload = vi.fn();
        reloadGroupPage(reload);
        expect(reload).toHaveBeenCalledOnce();
      });

      it.each(["deposit", "check-in"] as const)(
        "still attempts a best-effort refresh after %s uncertainty without unlocking it",
        async (operation) => {
          const harness = groupFinancialHarness();

          await expect(
            runGroupOperation(
              harness.guard,
              operation,
              async () => ({ ok: true, results: [uncertainRoom(702)] }),
              harness.effects,
            ),
          ).resolves.toBe("applied");

          expect(harness.refresh).toHaveBeenCalledOnce();
          expect(harness.guard.state).toBe("uncertain");
          expect(harness.uncertaintyMessage).toBe(
            GROUP_MUTATION_UNCERTAIN_MESSAGE,
          );
          expect(harness.success).not.toHaveBeenCalled();

          await expectEveryGroupOperationBlocked(harness.guard);
        },
      );

      it.each(["deposit", "check-in"] as const)(
        "keeps %s uncertainty intact when the restored refresh throws",
        async (operation) => {
          const harness = groupFinancialHarness();
          const consoleError = vi
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
          harness.refresh.mockImplementation(() => {
            throw new Error("uncertain refresh raw secret");
          });

          await expect(
            runGroupOperation(
              harness.guard,
              operation,
              async () => ({ ok: true, results: [uncertainRoom(703)] }),
              harness.effects,
            ),
          ).resolves.toBe("applied");

          expect(harness.guard.state).toBe("uncertain");
          expect(harness.uncertaintyMessage).toBe(
            GROUP_MUTATION_UNCERTAIN_MESSAGE,
          );
          expect(consoleError).toHaveBeenCalledWith(
            "[GroupFinancialClient] Follow-up failed",
            { sideEffect: "refresh" },
          );
          expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
            "uncertain refresh raw secret",
          );

          await expectEveryGroupOperationBlocked(harness.guard);
        },
      );

      it.each(GROUP_OPERATIONS)(
        "releases the lease to idle when the %s begin callback throws",
        (operation) => {
          const guard = createMutationGuard();
          const consoleError = vi
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
          const serverAction = vi.fn();

          const entry = beginGroupMutation(guard, operation, () => {
            throw new Error("begin raw secret");
          });

          expect(entry).toBe("blocked");
          expect(serverAction).not.toHaveBeenCalled();
          // No write can have started, so the panel must not stay locked.
          expect(guard.state).toBe("idle");
          expect(consoleError).toHaveBeenCalledWith(
            "[GroupFinancialClient] Follow-up failed",
            { sideEffect: "begin" },
          );
          expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
            "begin raw secret",
          );

          const retry = vi.fn();
          expect(beginGroupMutation(guard, operation, retry)).toBe("started");
          expect(retry).toHaveBeenCalledOnce();
        },
      );

      it("keeps normal ownership when the begin callback succeeds", () => {
        const guard = createMutationGuard();
        let owned: boolean | null = null;

        expect(
          beginGroupMutation(guard, "settlement", (lease) => {
            owned = groupMutationLeaseOwnsGuard(lease);
          }),
        ).toBe("started");
        expect(owned).toBe(true);
        expect(guard.state).toBe("in-flight");
        expect(acquireGroupMutationLease(guard, "deposit")).toBeNull();
      });

      it.each(["deposit", "settlement"] as const)(
        "runs the %s action and settles the guard when clearing the summary throws",
        async (operation) => {
          const harness = groupFinancialHarness();
          const consoleError = vi
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
          harness.effects.clearBatchResult = vi.fn(() => {
            throw new Error("clear raw secret");
          });
          const action = vi
            .fn<() => Promise<GroupActionResult>>()
            .mockResolvedValue({ ok: true, results: [completedRoom(704)] });

          await expect(
            runGroupOperation(harness.guard, operation, action, harness.effects),
          ).resolves.toBe("applied");

          // The guarded server action still ran, and the guard settled.
          expect(action).toHaveBeenCalledOnce();
          expect(harness.guard.state).toBe("committed");
          expect(harness.success).toHaveBeenCalledOnce();
          expect(consoleError).toHaveBeenCalledWith(
            "[GroupFinancialClient] Follow-up failed",
            { sideEffect: "clear-summary" },
          );
          expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
            "clear raw secret",
          );
        },
      );

      it("leaves no raw thrown message in rendered results or diagnostics", async () => {
        const harness = groupFinancialHarness();
        const consoleError = vi
          .spyOn(console, "error")
          .mockImplementation(() => undefined);

        await expect(
          runGroupOperation(
            harness.guard,
            "check-in",
            async () => {
              throw new Error("completeCheckIn raw transport secret");
            },
            harness.effects,
          ),
        ).resolves.toBe("applied");

        expect(harness.guard.state).toBe("uncertain");
        expect(harness.uncertaintyMessage).toBe(
          GROUP_MUTATION_UNCERTAIN_MESSAGE,
        );
        expect(JSON.stringify(harness.batchResult)).not.toContain(
          "raw transport secret",
        );
        expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
          "raw transport secret",
        );
      });
    });

    it("restores the batch 2B deposit and check-in summary presentation", () => {
      const outcome = resolvedGroupBatchOutcome(
        "Hasil pengumpulan deposit grup",
        [
          {
            reservationId: 1,
            reservationNo: "RSV-1",
            roomNumber: "101",
            status: "completed",
            reason: "Deposit dicatat.",
          },
          {
            reservationId: 2,
            reservationNo: "RSV-2",
            roomNumber: "102",
            status: "skipped",
            reason: "Deposit sudah dikumpulkan.",
          },
          {
            reservationId: 3,
            reservationNo: "RSV-3",
            roomNumber: "103",
            status: "failed",
            reason: "Deposit gagal.",
          },
        ],
        "dikumpulkan depositnya",
        "deposit-check-in",
      );

      expect(outcome.successMessage).toBe(
        "1 kamar berhasil dikumpulkan depositnya.",
      );
      expect(outcome.batchResult?.results).toHaveLength(2);
      expect(outcome.batchResult && batchSummaryText(outcome.batchResult)).toBe(
        "1 dilewati · 1 gagal",
      );
    });
  });
});
