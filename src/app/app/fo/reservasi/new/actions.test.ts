import { ReservationStatus, RoomStatus } from "@prisma/client";
import { permanentRedirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  cookieSet: vi.fn(),
  cookies: vi.fn(),
  logActivity: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  resolveNightlySchedule: vi.fn(),
  roomTypeFindMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/activity-log", () => ({ logActivity: mocks.logActivity }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    roomType: { findMany: mocks.roomTypeFindMany },
    $transaction: mocks.transaction,
  },
  TRANSACTION_OPTIONS: {},
}));
vi.mock("@/lib/pricing-resolver", () => {
  class PricingResolutionError extends Error {}

  return {
    PricingResolutionError,
    resolveNightlySchedule: mocks.resolveNightlySchedule,
  };
});
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();

  return { ...actual, redirect: mocks.redirect };
});

import { PricingResolutionError } from "@/lib/pricing-resolver";
import { ReservationStayFeeError } from "@/lib/reservation-stay-fees";
import {
  cancelReservation,
  createReservation,
  getReservationQuote,
  updateReservation,
} from "./actions";

const validCreateInput = {
  fullName: "Tamu Uji",
  idType: "KTP",
  idNumber: "",
  phone: "",
  email: "",
  address: "",
  nationality: "Indonesia",
  arrivalDate: "2026-10-01",
  departureDate: "2026-10-02",
  reservationType: "INDIVIDUAL",
  arrangementType: "RO",
  notes: "",
  stayFeeKinds: [],
  rooms: [{ roomTypeId: 1, roomId: 10, adults: 1, children: 0 }],
};

const validEditInput = {
  fullName: "Tamu Uji",
  idType: "KTP",
  idNumber: "",
  phone: "",
  email: "",
  address: "",
  nationality: "Indonesia",
  roomTypeId: 1,
  roomId: 10,
  arrivalDate: "2026-10-01",
  departureDate: "2026-10-02",
  adults: 1,
  children: 0,
  reservationType: "INDIVIDUAL",
  arrangementType: "RO",
  notes: "",
};

function transactionClient(options: {
  roomType?: { id: number; baseRate: number; capacity: number } | null;
  room?: {
    id: number;
    number: string;
    roomTypeId: number;
    status: RoomStatus;
  } | null;
  overlap?: { id: number } | null;
  reservation?: {
    id: number;
    status: ReservationStatus;
    folio: { id: number } | null;
  } | null;
  updatedCount?: number;
} = {}) {
  return {
    $queryRaw: vi.fn(async () => []),
    roomType: {
      findUnique: vi.fn(async () => options.roomType ?? null),
    },
    room: {
      findUnique: vi.fn(async () => options.room ?? null),
    },
    reservation: {
      findFirst: vi.fn(async () => options.overlap ?? null),
      findUnique: vi.fn(async () => options.reservation ?? null),
      updateMany: vi.fn(async () => ({ count: options.updatedCount ?? 1 })),
    },
    reservationStayFee: { updateMany: vi.fn(async () => ({ count: 0 })) },
  };
}

function genuineRedirectError() {
  try {
    permanentRedirect("/app/fo/reservasi");
  } catch (error) {
    return error;
  }

  throw new Error("Next.js permanentRedirect did not throw");
}

function runTransactionWith(tx: ReturnType<typeof transactionClient>) {
  mocks.transaction.mockImplementationOnce(
    async (callback: (client: typeof tx) => unknown) => callback(tx),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "1", role: "FO" } });
  mocks.cookies.mockResolvedValue({ set: mocks.cookieSet });
  mocks.logActivity.mockResolvedValue(undefined);
  mocks.redirect.mockImplementation(() => undefined);
  mocks.revalidatePath.mockImplementation(() => undefined);
  mocks.roomTypeFindMany.mockResolvedValue([{ id: 1, capacity: 2 }]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("reservation action failure boundary", () => {
  it("distinguishes a missing session from an insufficient role", async () => {
    mocks.auth.mockResolvedValueOnce(null);
    await expect(createReservation(validCreateInput)).resolves.toMatchObject({
      ok: false,
      code: "SESSION_EXPIRED",
      error: "Sesi Anda telah berakhir. Silakan masuk kembali.",
    });

    mocks.auth.mockResolvedValueOnce({ user: { id: "2", role: "HK" } });
    await expect(createReservation(validCreateInput)).resolves.toMatchObject({
      ok: false,
      code: "FORBIDDEN",
      error: "Anda tidak memiliki izin untuk melakukan tindakan ini.",
    });
  });

  it("returns Indonesian field validation without losing its target", async () => {
    await expect(
      createReservation({ ...validCreateInput, fullName: "" }),
    ).resolves.toMatchObject({
      ok: false,
      code: "INVALID_RESERVATION_DATA",
      error: "Nama tamu wajib diisi",
      field: "fullName",
    });

    const malformedResult = await createReservation({
      ...validCreateInput,
      fullName: null,
    });
    expect(malformedResult).toMatchObject({
      ok: false,
      code: "INVALID_RESERVATION_DATA",
      error: "Data reservasi tidak valid. Periksa kembali formulir.",
      field: "fullName",
    });
    if (!malformedResult.ok) {
      expect(malformedResult.error).not.toMatch(/invalid input|expected string/i);
    }
  });

  it("maps invalid room type, invalid room, OOO room, and unavailable room", async () => {
    mocks.roomTypeFindMany.mockResolvedValueOnce([]);
    runTransactionWith(transactionClient({ roomType: null }));
    await expect(createReservation(validCreateInput)).resolves.toMatchObject({
      ok: false,
      code: "INVALID_ROOM_TYPE",
      field: "rooms.0.roomTypeId",
    });

    runTransactionWith(
      transactionClient({
        roomType: { id: 1, baseRate: 500_000, capacity: 2 },
        room: null,
      }),
    );
    await expect(createReservation(validCreateInput)).resolves.toMatchObject({
      ok: false,
      code: "INVALID_ROOM",
      field: "rooms.0.roomId",
    });

    runTransactionWith(
      transactionClient({
        roomType: { id: 1, baseRate: 500_000, capacity: 2 },
        room: { id: 10, number: "101", roomTypeId: 1, status: RoomStatus.OOO },
      }),
    );
    await expect(createReservation(validCreateInput)).resolves.toMatchObject({
      ok: false,
      code: "ROOM_OOO",
      error: "Kamar 101 sedang berstatus OOO dan tidak dapat dipesan.",
      field: "rooms.0.roomId",
    });

    runTransactionWith(
      transactionClient({
        roomType: { id: 1, baseRate: 500_000, capacity: 2 },
        room: { id: 10, number: "101", roomTypeId: 1, status: RoomStatus.VC },
        overlap: { id: 99 },
      }),
    );
    await expect(createReservation(validCreateInput)).resolves.toMatchObject({
      ok: false,
      code: "ROOM_UNAVAILABLE",
      error:
        "Kamar 101 sudah tidak tersedia untuk tanggal tersebut. Pilih kamar lain.",
      field: "rooms.0.roomId",
    });
  });

  it("maps unavailable stay-fee configuration to dedicated safe copy", async () => {
    mocks.transaction.mockRejectedValueOnce(
      new ReservationStayFeeError("internal stay-fee configuration detail"),
    );

    await expect(
      createReservation({
        ...validCreateInput,
        stayFeeKinds: ["EARLY_CHECK_IN"],
      }),
    ).resolves.toEqual({
      ok: false,
      code: "STAY_FEE_UNAVAILABLE",
      error:
        "Biaya fleksibilitas yang dipilih sedang tidak tersedia. Hapus pilihan atau hubungi admin.",
      field: "stayFeeKinds",
    });
  });

  it("maps a missing reservation and stale cancellation without changing status", async () => {
    runTransactionWith(transactionClient({ reservation: null }));
    await expect(cancelReservation(77)).resolves.toMatchObject({
      ok: false,
      code: "RESERVATION_NOT_FOUND",
    });

    runTransactionWith(
      transactionClient({
        reservation: {
          id: 77,
          status: ReservationStatus.CONFIRMED,
          folio: null,
        },
        updatedCount: 0,
      }),
    );
    await expect(cancelReservation(77)).resolves.toMatchObject({
      ok: false,
      code: "RESERVATION_CONFLICT",
      error:
        "Reservasi berubah sejak halaman ini dibuka. Muat ulang data lalu coba lagi.",
    });
  });

  it("contains known and unknown quote exceptions", async () => {
    const internalMessage = "selector model PricingRule database id=991";
    mocks.resolveNightlySchedule.mockRejectedValueOnce(
      new PricingResolutionError(internalMessage),
    );
    const knownResult = await getReservationQuote({
      rooms: [{ roomTypeId: 1, adults: 1, children: 0 }],
      arrangementType: "RO",
      arrivalDate: "2026-10-01",
      departureDate: "2026-10-02",
    });

    expect(knownResult).toMatchObject({
      ok: false,
      code: "PRICING_QUOTE_FAILED",
      error: "Ringkasan harga tidak dapat dihitung. Silakan coba lagi.",
    });
    expect(knownResult).not.toEqual(expect.objectContaining({ error: internalMessage }));

    vi.spyOn(console, "error").mockImplementationOnce(() => undefined);
    mocks.resolveNightlySchedule.mockRejectedValueOnce(new Error(internalMessage));
    const unknownResult = await getReservationQuote({
      rooms: [{ roomTypeId: 1, adults: 1, children: 0 }],
      arrangementType: "RO",
      arrivalDate: "2026-10-01",
      departureDate: "2026-10-02",
    });

    expect(unknownResult).toMatchObject({
      ok: false,
      code: "PRICING_QUOTE_FAILED",
      error: "Ringkasan harga tidak dapat dihitung. Silakan coba lagi.",
    });
    expect(unknownResult).not.toEqual(expect.objectContaining({ error: internalMessage }));
  });

  it("continues a committed create to its success redirect when activity logging fails", async () => {
    const redirectError = genuineRedirectError();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.transaction.mockResolvedValueOnce({
      ok: true,
      reservationIds: [77],
      groupBookingId: null,
    });
    mocks.logActivity.mockRejectedValueOnce(new Error("activity service unavailable"));
    mocks.redirect.mockImplementationOnce(() => {
      throw redirectError;
    });

    await expect(createReservation(validCreateInput)).rejects.toBe(redirectError);
    expect(mocks.redirect).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledWith(
      "Reservation post-commit side effect failed",
      { action: "create", sideEffect: "activity-log" },
      expect.any(Error),
    );
  });

  it("continues a committed edit to its success redirect when activity logging fails", async () => {
    const redirectError = genuineRedirectError();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.transaction.mockResolvedValueOnce({ ok: true });
    mocks.logActivity.mockRejectedValueOnce(new Error("activity service unavailable"));
    mocks.redirect.mockImplementationOnce(() => {
      throw redirectError;
    });

    await expect(updateReservation(77, validEditInput)).rejects.toBe(redirectError);
    expect(mocks.redirect).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(3);
    expect(consoleError).toHaveBeenCalledWith(
      "Reservation post-commit side effect failed",
      { action: "edit", sideEffect: "activity-log" },
      expect.any(Error),
    );
  });

  it("keeps a committed cancellation successful when activity logging fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.transaction.mockResolvedValueOnce({ ok: true });
    mocks.logActivity.mockRejectedValueOnce(new Error("activity service unavailable"));

    await expect(cancelReservation(77)).resolves.toEqual({ ok: true });
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(3);
    expect(consoleError).toHaveBeenCalledWith(
      "Reservation post-commit side effect failed",
      { action: "cancel", sideEffect: "activity-log" },
      expect.any(Error),
    );
  });

  it("does not revalidate when the authoritative transaction fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.transaction.mockRejectedValueOnce(new Error("transaction failed"));

    await expect(createReservation(validCreateInput)).resolves.toMatchObject({
      ok: false,
      code: "UNEXPECTED_FAILURE",
      error: "Reservasi tidak dapat dibuat. Silakan coba lagi.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("contains unexpected create, edit, and cancellation exceptions", async () => {
    const internalMessage = "Prisma P2028 database transaction stack";
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    mocks.transaction.mockRejectedValueOnce(new Error(internalMessage));
    const createResult = await createReservation(validCreateInput);
    expect(createResult).toMatchObject({
      ok: false,
      code: "UNEXPECTED_FAILURE",
      error: "Reservasi tidak dapat dibuat. Silakan coba lagi.",
    });

    mocks.transaction.mockRejectedValueOnce(new Error(internalMessage));
    const editResult = await updateReservation(77, validEditInput);
    expect(editResult).toMatchObject({
      ok: false,
      code: "UNEXPECTED_FAILURE",
      error: "Perubahan reservasi tidak dapat disimpan. Silakan coba lagi.",
    });

    mocks.transaction.mockRejectedValueOnce(new Error(internalMessage));
    const cancelResult = await cancelReservation(77);
    expect(cancelResult).toMatchObject({
      ok: false,
      code: "UNEXPECTED_FAILURE",
      error: "Reservasi tidak dapat dibatalkan. Silakan coba lagi.",
    });

    for (const result of [createResult, editResult, cancelResult]) {
      if (!result.ok) {
        expect(result.error).not.toContain(internalMessage);
      }
    }
    expect(consoleError).toHaveBeenCalledTimes(3);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
