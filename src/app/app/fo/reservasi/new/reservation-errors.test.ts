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
  SESSION_EXPIRED: "Your session has expired. Please sign in again.",
  FORBIDDEN: "You do not have permission to perform this action.",
  INVALID_RESERVATION_DATA:
    "Invalid reservation data. Check the form.",
  RESERVATION_NOT_FOUND:
    "Reservation not found. Reload the page or return to the reservation list.",
  RESERVATION_CONFLICT:
    "The reservation has changed since this page was opened. Reload the data and try again.",
  ROOM_UNAVAILABLE:
    "The selected room is no longer available for those dates. Select another room.",
  INVALID_ROOM_TYPE: "The selected room type is invalid.",
  INVALID_ROOM: "The selected room is invalid.",
  ROOM_OOO:
    "The selected room is Out of Order (OOO) and cannot be reserved.",
  ROOM_BLOCKED: "The selected room is blocked during the stay. Select another room or different dates.",
  POST_CHECK_IN_EDIT_RESTRICTED:
    "This change cannot be made after check-in.",
  PRICING_QUOTE_FAILED:
    "Unable to calculate the rate summary. Please try again.",
  STAY_FEE_UNAVAILABLE:
    "The selected stay flexibility fee is unavailable. Remove the selection or contact an administrator.",
  CANCELLATION_FAILED:
    "Unable to cancel the reservation. Please try again.",
  UNEXPECTED_FAILURE: "An unexpected error occurred. Please try again.",
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
  it("has complete safe English copy for every stable failure code", () => {
    expect(new Set(RESERVATION_FAILURE_CODES).size).toBe(
      RESERVATION_FAILURE_CODES.length,
    );
    expect(Object.keys(expectedMessages).sort()).toEqual(
      [...RESERVATION_FAILURE_CODES].sort(),
    );

    for (const code of RESERVATION_FAILURE_CODES) {
      const message = reservationFailureMessage(code);

      expect(message).toBe(expectedMessages[code]);
      expect(message).not.toMatch(/reservasi|kamar|tidak|silakan|gagal/i);

      for (const term of forbiddenPublicTerms) {
        expect(message).not.toContain(term);
      }
    }
  });

  it("distinguishes a missing session from an authenticated forbidden role", () => {
    expect(reservationAuthorizationFailure(null, ["FO"])).toEqual({
      ok: false,
      code: "SESSION_EXPIRED",
      error: "Your session has expired. Please sign in again.",
    });
    expect(
      reservationAuthorizationFailure({ user: { role: "HK" } }, ["FO"]),
    ).toEqual({
      ok: false,
      code: "FORBIDDEN",
      error: "You do not have permission to perform this action.",
    });
    expect(
      reservationAuthorizationFailure({ user: { role: "FO" } }, ["FO"]),
    ).toBeNull();
  });

  it("preserves a safe field-specific validation message and target", () => {
    expect(
      reservationFailure("INVALID_RESERVATION_DATA", {
        message: "Guest name is required",
        field: "fullName",
      }),
    ).toEqual({
      ok: false,
      code: "INVALID_RESERVATION_DATA",
      error: "Guest name is required",
      field: "fullName",
    });
  });

  it("uses mode-appropriate copy for unexpected create, edit, quote, and cancellation failures", () => {
    expect(unexpectedReservationFailure("create").error).toBe(
      "Unable to create the reservation. Please try again.",
    );
    expect(unexpectedReservationFailure("edit").error).toBe(
      "Unable to save reservation changes. Please try again.",
    );
    expect(unexpectedReservationFailure("quote").error).toBe(
      "Unable to calculate the rate summary. Please try again.",
    );
    expect(unexpectedReservationFailure("cancel").error).toBe(
      "Unable to cancel the reservation. Please try again.",
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
      error: "Unable to create the reservation. Please try again.",
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
      error: "Unable to cancel the reservation. Please try again.",
    });
  });
});
