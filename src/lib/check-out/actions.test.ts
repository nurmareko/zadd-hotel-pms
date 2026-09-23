import {
  FolioStatus,
  PaymentMethod,
  Prisma,
  ReservationStatus,
} from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  logActivity: vi.fn(),
  postPendingStayCharges: vi.fn(),
  computeFolioTotals: vi.fn(),
  folioFindUnique: vi.fn(),
  settingsFindUnique: vi.fn(),
  lineItemFindMany: vi.fn(),
  transaction: vi.fn(),
  txFolioFindUnique: vi.fn(),
  txSettingsFindUnique: vi.fn(),
  txPaymentCreate: vi.fn(),
  txFolioUpdateMany: vi.fn(),
  txReservationUpdateMany: vi.fn(),
  txRoomUpdate: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/activity-log", () => ({ logActivity: mocks.logActivity }));
vi.mock("@/lib/folio-totals", () => ({
  computeFolioTotals: mocks.computeFolioTotals,
}));
vi.mock("@/lib/stay-charges", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stay-charges")>();
  return {
    ...actual,
    postPendingStayCharges: mocks.postPendingStayCharges,
  };
});
vi.mock("@/lib/prisma", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/prisma")>();
  return {
    ...actual,
    prisma: {
      folio: { findUnique: mocks.folioFindUnique },
      hotelSettings: { findUnique: mocks.settingsFindUnique },
      folioLineItem: { findMany: mocks.lineItemFindMany },
      $transaction: mocks.transaction,
    },
  };
});

import { StayChargePostingError } from "@/lib/stay-charges";
import { completeCheckout, recordFinalPayment } from "./actions";
import { checkoutFailure } from "./errors";

const settings = { id: 1 };
const reservation = {
  id: 12,
  status: ReservationStatus.CHECKED_IN,
  roomId: 5,
  room: { id: 5, status: "OC" },
};
const folio = {
  id: 8,
  reservationId: reservation.id,
  status: FolioStatus.OPEN,
  reservation,
  lineItems: [],
  payments: [],
};
const tx = {
  folio: {
    findUnique: mocks.txFolioFindUnique,
    updateMany: mocks.txFolioUpdateMany,
  },
  hotelSettings: { findUnique: mocks.txSettingsFindUnique },
  payment: { create: mocks.txPaymentCreate },
  reservation: { updateMany: mocks.txReservationUpdateMany },
  room: { update: mocks.txRoomUpdate },
};

function paymentForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("folioId", "8");
  formData.set("amount", "100000");
  formData.set("method", PaymentMethod.CASH);
  for (const [key, value] of Object.entries(overrides)) formData.set(key, value);
  return formData;
}

function checkoutForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("folioId", "8");
  formData.set("confirmed", "true");
  for (const [key, value] of Object.entries(overrides)) formData.set(key, value);
  return formData;
}

function serializationConflict() {
  return new Prisma.PrismaClientKnownRequestError("serialization", {
    code: "P2034",
    clientVersion: "6.19.3",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.auth.mockResolvedValue({ user: { id: "1", role: "FO" } });
  mocks.folioFindUnique.mockResolvedValue(folio);
  mocks.settingsFindUnique.mockResolvedValue(settings);
  mocks.lineItemFindMany.mockResolvedValue([]);
  mocks.postPendingStayCharges.mockResolvedValue(undefined);
  mocks.computeFolioTotals.mockReturnValue({ balance: 100_000 });
  mocks.txFolioFindUnique.mockResolvedValue(folio);
  mocks.txSettingsFindUnique.mockResolvedValue(settings);
  mocks.txPaymentCreate.mockResolvedValue({ id: 1 });
  mocks.txFolioUpdateMany.mockResolvedValue({ count: 1 });
  mocks.txReservationUpdateMany.mockResolvedValue({ count: 1 });
  mocks.txRoomUpdate.mockResolvedValue({});
  mocks.transaction.mockImplementation(async (callback) => callback(tx));
  mocks.logActivity.mockResolvedValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("recordFinalPayment", () => {
  it("returns targeted Indonesian validation without generated Zod text", async () => {
    const result = await recordFinalPayment(paymentForm({ amount: "not-a-number" }));

    expect(result).toEqual({
      ...checkoutFailure("INVALID_INPUT"),
      fieldErrors: { amount: ["Jumlah pembayaran tidak valid."] },
    });
    expect(mocks.folioFindUnique).not.toHaveBeenCalled();
  });

  it("distinguishes session expiry and permission denial", async () => {
    mocks.auth.mockResolvedValueOnce(null).mockResolvedValueOnce({
      user: { id: "2", role: "HK" },
    });

    await expect(recordFinalPayment(paymentForm())).resolves.toEqual(
      checkoutFailure("SESSION_EXPIRED"),
    );
    await expect(recordFinalPayment(paymentForm())).resolves.toEqual(
      checkoutFailure("FORBIDDEN"),
    );
  });

  it("maps missing folio and missing settings", async () => {
    mocks.folioFindUnique.mockResolvedValueOnce(null);
    await expect(recordFinalPayment(paymentForm())).resolves.toEqual(
      checkoutFailure("FOLIO_NOT_FOUND"),
    );

    mocks.settingsFindUnique.mockResolvedValueOnce(null);
    await expect(recordFinalPayment(paymentForm())).resolves.toEqual(
      checkoutFailure("SETTINGS_UNAVAILABLE"),
    );
  });

  it("maps closed folio, wrong reservation state, settled balance, and overpayment", async () => {
    mocks.folioFindUnique.mockResolvedValueOnce({
      ...folio,
      status: FolioStatus.CLOSED,
    });
    await expect(recordFinalPayment(paymentForm())).resolves.toEqual(
      checkoutFailure("FOLIO_NOT_OPEN"),
    );

    mocks.folioFindUnique.mockResolvedValueOnce({
      ...folio,
      reservation: { ...reservation, status: ReservationStatus.CHECKED_OUT },
    });
    await expect(recordFinalPayment(paymentForm())).resolves.toEqual(
      checkoutFailure("RESERVATION_NOT_CHECKED_IN"),
    );

    mocks.computeFolioTotals.mockReturnValueOnce({ balance: 0 });
    await expect(recordFinalPayment(paymentForm())).resolves.toEqual(
      checkoutFailure("BALANCE_ALREADY_SETTLED"),
    );

    mocks.computeFolioTotals.mockReturnValueOnce({ balance: 50_000 });
    await expect(recordFinalPayment(paymentForm())).resolves.toEqual(
      checkoutFailure("PAYMENT_EXCEEDS_BALANCE"),
    );
  });

  it("maps every structured stay-charge blocker without exposing its message", async () => {
    mocks.postPendingStayCharges.mockRejectedValueOnce(
      new StayChargePostingError("raw reservation id 991", {
        kind: "INVALID_ROOM_RATE",
        nightId: "secret-night",
        affectedDate: new Date(),
        rateAmount: "bad-rate",
      }),
    );

    await expect(recordFinalPayment(paymentForm())).resolves.toEqual(
      checkoutFailure("ROOM_RATE_INVALID"),
    );
  });

  it("returns PAYMENT_CONFLICT after the existing three retries", async () => {
    mocks.transaction.mockRejectedValue(serializationConflict());

    await expect(recordFinalPayment(paymentForm())).resolves.toEqual(
      checkoutFailure("PAYMENT_CONFLICT"),
    );
    expect(mocks.transaction).toHaveBeenCalledTimes(3);
  });

  it("returns FINAL_PAYMENT_UNEXPECTED for an unexpected pre-commit failure", async () => {
    mocks.folioFindUnique.mockRejectedValueOnce(new Error("raw Prisma secret"));

    const result = await recordFinalPayment(paymentForm());

    expect(result).toEqual(checkoutFailure("FINAL_PAYMENT_UNEXPECTED"));
    expect(result.ok || result.error).not.toContain("Prisma");
  });

  it("retains confirmed success after logging and revalidation failures", async () => {
    mocks.computeFolioTotals.mockReturnValue({ balance: 100_000 });
    mocks.logActivity.mockRejectedValueOnce(new Error("activity unavailable"));
    mocks.revalidatePath.mockImplementation(() => {
      throw new Error("cache unavailable");
    });

    await expect(recordFinalPayment(paymentForm())).resolves.toEqual({ ok: true });
    expect(mocks.txPaymentCreate).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(3);
  });

  it("rethrows framework control-flow errors", async () => {
    const frameworkError = new Error("NEXT_REDIRECT");
    (frameworkError as Error & { digest: string }).digest =
      "NEXT_REDIRECT;replace;/login;307;";
    mocks.folioFindUnique.mockRejectedValueOnce(frameworkError);

    await expect(recordFinalPayment(paymentForm())).rejects.toThrow("NEXT_REDIRECT");
  });
});

describe("completeCheckout", () => {
  beforeEach(() => {
    mocks.computeFolioTotals.mockReturnValue({ balance: 0 });
  });

  it("returns a targeted confirmation validation failure", async () => {
    const result = await completeCheckout(checkoutForm({ confirmed: "false" }));

    expect(result).toEqual({
      ...checkoutFailure("INVALID_INPUT"),
      fieldErrors: {
        confirmed: ["Konfirmasi wajib dicentang sebelum check-out."],
      },
    });
  });

  it("maps missing data, voided folio, and wrong reservation state", async () => {
    mocks.folioFindUnique.mockResolvedValueOnce(null);
    await expect(completeCheckout(checkoutForm())).resolves.toEqual(
      checkoutFailure("FOLIO_NOT_FOUND"),
    );

    mocks.settingsFindUnique.mockResolvedValueOnce(null);
    await expect(completeCheckout(checkoutForm())).resolves.toEqual(
      checkoutFailure("SETTINGS_UNAVAILABLE"),
    );

    mocks.folioFindUnique.mockResolvedValueOnce({
      ...folio,
      status: FolioStatus.VOIDED,
    });
    await expect(completeCheckout(checkoutForm())).resolves.toEqual(
      checkoutFailure("FOLIO_VOIDED"),
    );

    mocks.folioFindUnique.mockResolvedValueOnce({
      ...folio,
      reservation: { ...reservation, status: ReservationStatus.CHECKED_OUT },
    });
    await expect(completeCheckout(checkoutForm())).resolves.toEqual(
      checkoutFailure("RESERVATION_NOT_CHECKED_IN"),
    );
  });

  it("truthfully returns the formatted balance after stay-charge posting", async () => {
    mocks.computeFolioTotals.mockReturnValueOnce({ balance: 125_000 });

    await expect(completeCheckout(checkoutForm())).resolves.toEqual(
      checkoutFailure("BALANCE_DUE", { amount: "Rp 125.000" }),
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("maps folio and reservation compare-and-swap failures", async () => {
    mocks.txFolioUpdateMany.mockResolvedValueOnce({ count: 0 });
    await expect(completeCheckout(checkoutForm())).resolves.toEqual(
      checkoutFailure("FOLIO_CHANGED"),
    );

    mocks.txReservationUpdateMany.mockResolvedValueOnce({ count: 0 });
    await expect(completeCheckout(checkoutForm())).resolves.toEqual(
      checkoutFailure("RESERVATION_NOT_CHECKED_IN"),
    );
  });

  it("returns CHECKOUT_CONFLICT after the existing three retries", async () => {
    mocks.transaction.mockRejectedValue(serializationConflict());

    await expect(completeCheckout(checkoutForm())).resolves.toEqual(
      checkoutFailure("CHECKOUT_CONFLICT"),
    );
    expect(mocks.transaction).toHaveBeenCalledTimes(3);
  });

  it("keeps already-closed checkout idempotently successful when revalidation fails", async () => {
    mocks.folioFindUnique.mockResolvedValueOnce({
      ...folio,
      status: FolioStatus.CLOSED,
    });
    mocks.revalidatePath.mockImplementation(() => {
      throw new Error("cache unavailable");
    });

    await expect(completeCheckout(checkoutForm())).resolves.toEqual({ ok: true });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("retains committed checkout success after post-commit side-effect failures", async () => {
    mocks.logActivity.mockRejectedValueOnce(new Error("activity unavailable"));
    mocks.revalidatePath.mockImplementation(() => {
      throw new Error("cache unavailable");
    });

    await expect(completeCheckout(checkoutForm())).resolves.toEqual({ ok: true });
    expect(mocks.txFolioUpdateMany).toHaveBeenCalledOnce();
    expect(mocks.txReservationUpdateMany).toHaveBeenCalledOnce();
    expect(mocks.txRoomUpdate).toHaveBeenCalledOnce();
  });

  it("maps stay-charge blockers and rethrows framework errors", async () => {
    mocks.postPendingStayCharges.mockRejectedValueOnce(
      new StayChargePostingError("raw ids", {
        kind: "MISSING_STAY_CHARGE_ARTICLE",
        articleCode: "ROOM-SECRET",
        affectedDate: null,
      }),
    );
    await expect(completeCheckout(checkoutForm())).resolves.toEqual(
      checkoutFailure("STAY_ARTICLE_MISSING"),
    );

    const frameworkError = new Error("NEXT_REDIRECT");
    (frameworkError as Error & { digest: string }).digest =
      "NEXT_REDIRECT;replace;/login;307;";
    mocks.folioFindUnique.mockRejectedValueOnce(frameworkError);
    await expect(completeCheckout(checkoutForm())).rejects.toThrow("NEXT_REDIRECT");
  });
});
