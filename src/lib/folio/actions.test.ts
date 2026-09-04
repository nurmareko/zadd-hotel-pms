import { ArticleType, FolioStatus, PaymentMethod, Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  logActivity: vi.fn(),
  revalidatePath: vi.fn(),
  folioFindUnique: vi.fn(),
  articleFindUnique: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/activity-log", () => ({ logActivity: mocks.logActivity }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    folio: { findUnique: mocks.folioFindUnique },
    article: { findUnique: mocks.articleFindUnique },
    $transaction: mocks.transaction,
  },
  TRANSACTION_OPTIONS: {},
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { postCharge, recordPayment } from "./actions";
import { FOLIO_FAILURE_MESSAGES } from "./errors";

function createChargeFormData(overrides: Record<string, string> = {}) {
  const data = new FormData();
  data.set("folioId", "10");
  data.set("articleId", "5");
  data.set("description", "Minibar Water");
  data.set("quantity", "2");
  data.set("unitPrice", "25000");

  for (const [key, value] of Object.entries(overrides)) {
    if (value === "") {
      data.delete(key);
    } else {
      data.set(key, value);
    }
  }

  return data;
}

function createPaymentFormData(overrides: Record<string, string> = {}) {
  const data = new FormData();
  data.set("folioId", "10");
  data.set("amount", "50000");
  data.set("method", PaymentMethod.CASH);
  data.set("reference", "");

  for (const [key, value] of Object.entries(overrides)) {
    if (value === "") {
      data.delete(key);
    } else {
      data.set(key, value);
    }
  }

  return data;
}

describe("folio server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({
      user: { id: "1", role: "FO" },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("postCharge", () => {
    it("returns SESSION_EXPIRED when session is missing", async () => {
      mocks.auth.mockResolvedValueOnce(null);

      const result = await postCharge(createChargeFormData());

      expect(result).toEqual({
        ok: false,
        code: "SESSION_EXPIRED",
        error: FOLIO_FAILURE_MESSAGES.SESSION_EXPIRED,
      });
      expect(mocks.folioFindUnique).not.toHaveBeenCalled();
    });

    it("returns FORBIDDEN when user role is not FO", async () => {
      mocks.auth.mockResolvedValueOnce({
        user: { id: "2", role: "HK" },
      });

      const result = await postCharge(createChargeFormData());

      expect(result).toEqual({
        ok: false,
        code: "FORBIDDEN",
        error: FOLIO_FAILURE_MESSAGES.FORBIDDEN,
      });
      expect(mocks.folioFindUnique).not.toHaveBeenCalled();
    });

    it("returns INVALID_INPUT without leaking Zod English error messages", async () => {
      const result = await postCharge(
        createChargeFormData({ quantity: "-1" }),
      );

      expect(result).toEqual({
        ok: false,
        code: "INVALID_INPUT",
        error: FOLIO_FAILURE_MESSAGES.INVALID_INPUT,
      });
      if (!result.ok) {
        expect(result.error).not.toMatch(/greater than|expected|number|invalid/i);
      }
    });

    it("returns FOLIO_NOT_FOUND when advisory folio read finds nothing", async () => {
      mocks.folioFindUnique.mockResolvedValueOnce(null);

      const result = await postCharge(createChargeFormData());

      expect(result).toEqual({
        ok: false,
        code: "FOLIO_NOT_FOUND",
        error: FOLIO_FAILURE_MESSAGES.FOLIO_NOT_FOUND,
      });
    });

    it("returns FOLIO_NOT_OPEN when advisory folio read shows closed folio", async () => {
      mocks.folioFindUnique.mockResolvedValueOnce({
        id: 10,
        reservationId: 1,
        status: FolioStatus.CLOSED,
      });

      const result = await postCharge(createChargeFormData());

      expect(result).toEqual({
        ok: false,
        code: "FOLIO_NOT_OPEN",
        error: FOLIO_FAILURE_MESSAGES.FOLIO_NOT_OPEN,
      });
    });

    it("returns ARTICLE_NOT_FOUND when article does not exist", async () => {
      mocks.folioFindUnique.mockResolvedValueOnce({
        id: 10,
        reservationId: 1,
        status: FolioStatus.OPEN,
      });
      mocks.articleFindUnique.mockResolvedValueOnce(null);

      const result = await postCharge(createChargeFormData());

      expect(result).toEqual({
        ok: false,
        code: "ARTICLE_NOT_FOUND",
        error: FOLIO_FAILURE_MESSAGES.ARTICLE_NOT_FOUND,
      });
    });

    it("returns PROTECTED_TAX_ARTICLE when article is of TAX type", async () => {
      mocks.folioFindUnique.mockResolvedValueOnce({
        id: 10,
        reservationId: 1,
        status: FolioStatus.OPEN,
      });
      mocks.articleFindUnique.mockResolvedValueOnce({
        id: 5,
        code: "TAX-10",
        name: "Pajak 10%",
        type: ArticleType.TAX,
      });

      const result = await postCharge(createChargeFormData());

      expect(result).toEqual({
        ok: false,
        code: "PROTECTED_TAX_ARTICLE",
        error: FOLIO_FAILURE_MESSAGES.PROTECTED_TAX_ARTICLE,
      });
    });

    it("returns PROTECTED_STAY_ARTICLE when article is a stay charge or fee", async () => {
      mocks.folioFindUnique.mockResolvedValueOnce({
        id: 10,
        reservationId: 1,
        status: FolioStatus.OPEN,
      });
      mocks.articleFindUnique.mockResolvedValueOnce({
        id: 5,
        code: "ROOM-CHARGE",
        name: "Biaya Kamar",
        type: ArticleType.ROOM,
      });

      const result = await postCharge(createChargeFormData());

      expect(result).toEqual({
        ok: false,
        code: "PROTECTED_STAY_ARTICLE",
        error: FOLIO_FAILURE_MESSAGES.PROTECTED_STAY_ARTICLE,
      });
    });

    it("returns FOLIO_NOT_OPEN when in-transaction re-check shows closed status", async () => {
      mocks.folioFindUnique.mockResolvedValueOnce({
        id: 10,
        reservationId: 1,
        status: FolioStatus.OPEN,
      });
      mocks.articleFindUnique.mockResolvedValueOnce({
        id: 5,
        code: "LAUNDRY",
        name: "Laundry",
        type: ArticleType.SERVICE,
      });

      mocks.transaction.mockImplementationOnce(async (callback) => {
        const tx = {
          folio: {
            findUnique: vi.fn().mockResolvedValueOnce({
              id: 10,
              status: FolioStatus.CLOSED,
            }),
          },
          folioLineItem: { create: vi.fn() },
        };
        return callback(tx);
      });

      const result = await postCharge(createChargeFormData());

      expect(result).toEqual({
        ok: false,
        code: "FOLIO_NOT_OPEN",
        error: FOLIO_FAILURE_MESSAGES.FOLIO_NOT_OPEN,
      });
    });

    it("retries on serialization conflict P2034 and succeeds", async () => {
      mocks.folioFindUnique.mockResolvedValueOnce({
        id: 10,
        reservationId: 1,
        status: FolioStatus.OPEN,
      });
      mocks.articleFindUnique.mockResolvedValueOnce({
        id: 5,
        code: "LAUNDRY",
        name: "Laundry",
        type: ArticleType.SERVICE,
      });

      const conflictError = new Prisma.PrismaClientKnownRequestError(
        "Serialization conflict",
        { code: "P2034", clientVersion: "6.0.0" },
      );

      let attempts = 0;
      mocks.transaction.mockImplementation(async (callback) => {
        attempts += 1;
        if (attempts === 1) {
          throw conflictError;
        }

        const tx = {
          folio: {
            findUnique: vi.fn().mockResolvedValueOnce({
              id: 10,
              status: FolioStatus.OPEN,
            }),
          },
          folioLineItem: { create: vi.fn().mockResolvedValueOnce({ id: 1 }) },
        };
        return callback(tx);
      });

      const result = await postCharge(createChargeFormData());

      expect(result).toEqual({ ok: true });
      expect(attempts).toBe(2);
      expect(mocks.logActivity).toHaveBeenCalledTimes(1);
    });

    it("returns CHARGE_CONFLICT when serialization conflicts are exhausted", async () => {
      mocks.folioFindUnique.mockResolvedValueOnce({
        id: 10,
        reservationId: 1,
        status: FolioStatus.OPEN,
      });
      mocks.articleFindUnique.mockResolvedValueOnce({
        id: 5,
        code: "LAUNDRY",
        name: "Laundry",
        type: ArticleType.SERVICE,
      });

      const conflictError = new Prisma.PrismaClientKnownRequestError(
        "Serialization conflict",
        { code: "P2034", clientVersion: "6.0.0" },
      );

      mocks.transaction.mockRejectedValue(conflictError);

      const result = await postCharge(createChargeFormData());

      expect(result).toEqual({
        ok: false,
        code: "CHARGE_CONFLICT",
        error: FOLIO_FAILURE_MESSAGES.CHARGE_CONFLICT,
      });
      expect(mocks.transaction).toHaveBeenCalledTimes(3);
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("returns CHARGE_UNEXPECTED and logs safe context when transaction throws unexpected error", async () => {
      mocks.folioFindUnique.mockResolvedValueOnce({
        id: 10,
        reservationId: 1,
        status: FolioStatus.OPEN,
      });
      mocks.articleFindUnique.mockResolvedValueOnce({
        id: 5,
        code: "LAUNDRY",
        name: "Laundry",
        type: ArticleType.SERVICE,
      });

      const rawDbError = new Error("Connection terminated unexpectedly");
      mocks.transaction.mockRejectedValueOnce(rawDbError);

      const result = await postCharge(createChargeFormData());

      expect(result).toEqual({
        ok: false,
        code: "CHARGE_UNEXPECTED",
        error: FOLIO_FAILURE_MESSAGES.CHARGE_UNEXPECTED,
      });
      if (!result.ok) {
        expect(result.error).not.toContain("Connection terminated");
      }
    });

    it("preserves truthful success if post-commit side-effect throws", async () => {
      mocks.folioFindUnique.mockResolvedValueOnce({
        id: 10,
        reservationId: 1,
        status: FolioStatus.OPEN,
      });
      mocks.articleFindUnique.mockResolvedValueOnce({
        id: 5,
        code: "LAUNDRY",
        name: "Laundry",
        type: ArticleType.SERVICE,
      });

      mocks.transaction.mockImplementationOnce(async (callback) => {
        const tx = {
          folio: {
            findUnique: vi.fn().mockResolvedValueOnce({
              id: 10,
              status: FolioStatus.OPEN,
            }),
          },
          folioLineItem: { create: vi.fn().mockResolvedValueOnce({ id: 1 }) },
        };
        return callback(tx);
      });

      // logActivity fails post-commit
      mocks.logActivity.mockRejectedValueOnce(
        new Error("Activity log service unavailable"),
      );

      const result = await postCharge(createChargeFormData());

      // Financial mutation committed, so action MUST still return { ok: true }
      expect(result).toEqual({ ok: true });
      // Revalidation still ran after activity log failed
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/fo/folios/10");
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/fo/reservasi/1");
    });

    it("continues running later revalidations when an earlier revalidation fails", async () => {
      mocks.folioFindUnique.mockResolvedValueOnce({
        id: 10,
        reservationId: 1,
        status: FolioStatus.OPEN,
      });
      mocks.articleFindUnique.mockResolvedValueOnce({
        id: 5,
        code: "LAUNDRY",
        name: "Laundry",
        type: ArticleType.SERVICE,
      });

      mocks.transaction.mockImplementationOnce(async (callback) => {
        const tx = {
          folio: {
            findUnique: vi.fn().mockResolvedValueOnce({
              id: 10,
              status: FolioStatus.OPEN,
            }),
          },
          folioLineItem: { create: vi.fn().mockResolvedValueOnce({ id: 1 }) },
        };
        return callback(tx);
      });

      mocks.revalidatePath.mockImplementationOnce(() => {
        throw new Error("First revalidation timed out");
      });

      const result = await postCharge(createChargeFormData());

      expect(result).toEqual({ ok: true });
      // Both revalidations were attempted
      expect(mocks.revalidatePath).toHaveBeenCalledTimes(2);
    });
  });

  describe("recordPayment", () => {
    it("returns SESSION_EXPIRED when session is missing", async () => {
      mocks.auth.mockResolvedValueOnce(null);

      const result = await recordPayment(createPaymentFormData());

      expect(result).toEqual({
        ok: false,
        code: "SESSION_EXPIRED",
        error: FOLIO_FAILURE_MESSAGES.SESSION_EXPIRED,
      });
    });

    it("returns FORBIDDEN when user role is not FO", async () => {
      mocks.auth.mockResolvedValueOnce({
        user: { id: "3", role: "FB" },
      });

      const result = await recordPayment(createPaymentFormData());

      expect(result).toEqual({
        ok: false,
        code: "FORBIDDEN",
        error: FOLIO_FAILURE_MESSAGES.FORBIDDEN,
      });
    });

    it("returns INVALID_INPUT on non-positive payment amount", async () => {
      const result = await recordPayment(
        createPaymentFormData({ amount: "0" }),
      );

      expect(result).toEqual({
        ok: false,
        code: "INVALID_INPUT",
        error: FOLIO_FAILURE_MESSAGES.INVALID_INPUT,
      });
    });

    it("returns FOLIO_NOT_FOUND when folio does not exist", async () => {
      mocks.folioFindUnique.mockResolvedValueOnce(null);

      const result = await recordPayment(createPaymentFormData());

      expect(result).toEqual({
        ok: false,
        code: "FOLIO_NOT_FOUND",
        error: FOLIO_FAILURE_MESSAGES.FOLIO_NOT_FOUND,
      });
    });

    it("returns FOLIO_NOT_OPEN when folio is closed", async () => {
      mocks.folioFindUnique.mockResolvedValueOnce({
        id: 10,
        reservationId: 1,
        status: FolioStatus.CLOSED,
      });

      const result = await recordPayment(createPaymentFormData());

      expect(result).toEqual({
        ok: false,
        code: "FOLIO_NOT_OPEN",
        error: FOLIO_FAILURE_MESSAGES.FOLIO_NOT_OPEN,
      });
    });

    it("returns PAYMENT_CONFLICT when serialization conflicts exhaust retries", async () => {
      mocks.folioFindUnique.mockResolvedValueOnce({
        id: 10,
        reservationId: 1,
        status: FolioStatus.OPEN,
      });

      const conflictError = new Prisma.PrismaClientKnownRequestError(
        "Serialization conflict",
        { code: "P2034", clientVersion: "6.0.0" },
      );

      mocks.transaction.mockRejectedValue(conflictError);

      const result = await recordPayment(createPaymentFormData());

      expect(result).toEqual({
        ok: false,
        code: "PAYMENT_CONFLICT",
        error: FOLIO_FAILURE_MESSAGES.PAYMENT_CONFLICT,
      });
      expect(mocks.transaction).toHaveBeenCalledTimes(3);
    });

    it("returns PAYMENT_UNEXPECTED when transaction encounters unexpected failure", async () => {
      mocks.folioFindUnique.mockResolvedValueOnce({
        id: 10,
        reservationId: 1,
        status: FolioStatus.OPEN,
      });

      mocks.transaction.mockRejectedValueOnce(
        new Error("Prisma deadlock detector error code"),
      );

      const result = await recordPayment(createPaymentFormData());

      expect(result).toEqual({
        ok: false,
        code: "PAYMENT_UNEXPECTED",
        error: FOLIO_FAILURE_MESSAGES.PAYMENT_UNEXPECTED,
      });
      if (!result.ok) {
        expect(result.error).not.toContain("Prisma");
      }
    });

    it("successfully records payment and runs post-commit side effects", async () => {
      mocks.folioFindUnique.mockResolvedValueOnce({
        id: 10,
        reservationId: 1,
        status: FolioStatus.OPEN,
      });

      let createdData: unknown;
      mocks.transaction.mockImplementationOnce(async (callback) => {
        const tx = {
          folio: {
            findUnique: vi.fn().mockResolvedValueOnce({
              id: 10,
              status: FolioStatus.OPEN,
            }),
          },
          payment: {
            create: vi.fn().mockImplementationOnce(({ data }) => {
              createdData = data;
              return { id: 1, ...data };
            }),
          },
        };
        return callback(tx);
      });

      const result = await recordPayment(
        createPaymentFormData({
          amount: "150000",
          method: PaymentMethod.TRANSFER,
          reference: "TRF-9988",
        }),
      );

      expect(result).toEqual({ ok: true });
      expect(createdData).toMatchObject({
        folioId: 10,
        amount: 150000,
        method: PaymentMethod.TRANSFER,
        reference: "TRF-9988",
        receivedById: 1,
      });

      expect(mocks.logActivity).toHaveBeenCalledWith({
        userId: 1,
        action: "PAYMENT_RECORDED",
        folioId: 10,
        metadata: {
          amount: 150000,
          method: PaymentMethod.TRANSFER,
        },
      });

      expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/fo/folios/10");
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/fo/reservasi/1");
    });
  });
});
