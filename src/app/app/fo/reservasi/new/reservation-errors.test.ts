import { redirect } from "next/navigation";
import { describe, expect, it } from "vitest";

import {
  RESERVATION_FAILURE_CODES,
  reservationAuthorizationFailure,
  reservationFailure,
  reservationFailureMessage,
  safelyRunReservationAction,
  unexpectedReservationFailure,
  type ReservationFailureCode,
} from "./reservation-errors";

const expectedMessages: Record<ReservationFailureCode, string> = {
  SESSION_EXPIRED: "Sesi Anda telah berakhir. Silakan masuk kembali.",
  FORBIDDEN: "Anda tidak memiliki izin untuk melakukan tindakan ini.",
  INVALID_RESERVATION_DATA:
    "Data reservasi tidak valid. Periksa kembali formulir.",
  RESERVATION_NOT_FOUND:
    "Reservasi tidak ditemukan. Muat ulang halaman atau kembali ke daftar reservasi.",
  RESERVATION_CONFLICT:
    "Reservasi berubah sejak halaman ini dibuka. Muat ulang data lalu coba lagi.",
  ROOM_UNAVAILABLE:
    "Kamar yang dipilih sudah tidak tersedia untuk tanggal tersebut. Pilih kamar lain.",
  INVALID_ROOM_TYPE: "Tipe kamar yang dipilih tidak valid.",
  INVALID_ROOM: "Kamar yang dipilih tidak valid.",
  ROOM_OOO:
    "Kamar yang dipilih sedang berstatus OOO dan tidak dapat dipesan.",
  POST_CHECK_IN_EDIT_RESTRICTED:
    "Perubahan ini tidak dapat dilakukan setelah check-in.",
  PRICING_QUOTE_FAILED:
    "Ringkasan harga tidak dapat dihitung. Silakan coba lagi.",
  STAY_FEE_UNAVAILABLE:
    "Biaya fleksibilitas yang dipilih sedang tidak tersedia. Hapus pilihan atau hubungi admin.",
  CANCELLATION_FAILED:
    "Reservasi tidak dapat dibatalkan. Silakan coba lagi.",
  UNEXPECTED_FAILURE: "Terjadi kegagalan yang tidak terduga. Silakan coba lagi.",
};

const forbiddenPublicTerms = [
  "Prisma",
  "database",
  "model",
  "selector",
  "serialization",
  "stack",
];

describe("reservation failure contract", () => {
  it("has complete safe Indonesian copy for every stable failure code", () => {
    expect(new Set(RESERVATION_FAILURE_CODES).size).toBe(
      RESERVATION_FAILURE_CODES.length,
    );
    expect(Object.keys(expectedMessages).sort()).toEqual(
      [...RESERVATION_FAILURE_CODES].sort(),
    );

    for (const code of RESERVATION_FAILURE_CODES) {
      const message = reservationFailureMessage(code);

      expect(message).toBe(expectedMessages[code]);
      expect(message).not.toMatch(/unauthorized|invalid reservation|not found|something went wrong|no longer available/i);

      for (const term of forbiddenPublicTerms) {
        expect(message).not.toContain(term);
      }
    }
  });

  it("distinguishes a missing session from an authenticated forbidden role", () => {
    expect(reservationAuthorizationFailure(null, ["FO"])).toEqual({
      ok: false,
      code: "SESSION_EXPIRED",
      error: "Sesi Anda telah berakhir. Silakan masuk kembali.",
    });
    expect(
      reservationAuthorizationFailure({ user: { role: "HK" } }, ["FO"]),
    ).toEqual({
      ok: false,
      code: "FORBIDDEN",
      error: "Anda tidak memiliki izin untuk melakukan tindakan ini.",
    });
    expect(
      reservationAuthorizationFailure({ user: { role: "FO" } }, ["FO"]),
    ).toBeNull();
  });

  it("preserves a safe field-specific validation message and target", () => {
    expect(
      reservationFailure("INVALID_RESERVATION_DATA", {
        message: "Nama tamu wajib diisi",
        field: "fullName",
      }),
    ).toEqual({
      ok: false,
      code: "INVALID_RESERVATION_DATA",
      error: "Nama tamu wajib diisi",
      field: "fullName",
    });
  });

  it("uses mode-appropriate copy for unexpected create, edit, quote, and cancellation failures", () => {
    expect(unexpectedReservationFailure("create").error).toBe(
      "Reservasi tidak dapat dibuat. Silakan coba lagi.",
    );
    expect(unexpectedReservationFailure("edit").error).toBe(
      "Perubahan reservasi tidak dapat disimpan. Silakan coba lagi.",
    );
    expect(unexpectedReservationFailure("quote").error).toBe(
      "Ringkasan harga tidak dapat dihitung. Silakan coba lagi.",
    );
    expect(unexpectedReservationFailure("cancel").error).toBe(
      "Reservasi tidak dapat dibatalkan. Silakan coba lagi.",
    );
  });

  it("never incorporates raw pricing or service exception text", () => {
    const internalPricingError = new Error(
      "Prisma P2028 model Reservation selector roomTypeId=481 stack trace",
    );

    const pricingFailure = reservationFailure("PRICING_QUOTE_FAILED");
    const unexpectedFailure = unexpectedReservationFailure("create");

    expect(pricingFailure.error).not.toContain(internalPricingError.message);
    expect(unexpectedFailure.error).not.toContain(internalPricingError.message);
    expect(pricingFailure.error).toBe(expectedMessages.PRICING_QUOTE_FAILED);
  });

  it("rethrows a genuine Next.js redirect control-flow error", async () => {
    let redirectError: unknown;

    try {
      redirect("/app/fo/reservasi");
    } catch (error) {
      redirectError = error;
    }

    await expect(
      safelyRunReservationAction(async () => {
        throw redirectError;
      }, "create"),
    ).rejects.toBe(redirectError);
  });

  it("rethrows a Next.js router error wrapped through Error.cause", async () => {
    let redirectError: unknown;

    try {
      redirect("/app/fo/reservasi");
    } catch (error) {
      redirectError = error;
    }

    const wrappedError = new Error("Server action transport wrapper", {
      cause: redirectError,
    });

    await expect(
      safelyRunReservationAction(async () => {
        throw wrappedError;
      }, "edit"),
    ).rejects.toBe(redirectError);
  });

  it("does not mistake a malformed redirect-like digest for router control flow", async () => {
    const malformedError = Object.assign(new Error("not a redirect"), {
      digest: "NEXT_REDIRECT-malformed",
    });

    await expect(
      safelyRunReservationAction(async () => {
        throw malformedError;
      }, "create"),
    ).resolves.toEqual({
      ok: false,
      code: "UNEXPECTED_FAILURE",
      error: "Reservasi tidak dapat dibuat. Silakan coba lagi.",
    });
  });

  it("converts a rejected client action promise into a safe recoverable result", async () => {
    const result = await safelyRunReservationAction(
      async () => {
        throw new Error("Prisma connection failed with database credentials");
      },
      "cancel",
    );

    expect(result).toEqual({
      ok: false,
      code: "UNEXPECTED_FAILURE",
      error: "Reservasi tidak dapat dibatalkan. Silakan coba lagi.",
    });
  });
});
