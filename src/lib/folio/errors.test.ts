import { describe, expect, it } from "vitest";

import {
  FOLIO_FAILURE_CODES,
  FOLIO_FAILURE_MESSAGES,
  folioFailure,
  folioFailureMessage,
  INITIAL_FOLIO_DIALOG_UI_STATE,
  reduceFolioActionResult,
  reduceFolioDialogClose,
  type FolioFailureCode,
} from "./errors";

const expectedMessages: Record<FolioFailureCode, string> = {
  SESSION_EXPIRED: "Your session has expired. Please sign in again.",
  FORBIDDEN: "You do not have permission to perform this action.",
  INVALID_INPUT: "Invalid folio data. Please review the form.",
  FOLIO_NOT_FOUND:
    "Folio not found. Reload the page and try again.",
  FOLIO_NOT_OPEN:
    "The folio is no longer open. Reload the page to see its current status.",
  NIGHT_AUDIT_CLOSED:
    "Night Audit for the current business date is complete. Folio transactions cannot be recorded.",
  ARTICLE_NOT_FOUND:
    "The article was not found or is no longer available. Select another article.",
  PROTECTED_TAX_ARTICLE:
    "Tax is calculated automatically and cannot be added manually.",
  PROTECTED_STAY_ARTICLE:
    "This stay charge is recorded automatically and cannot be added manually.",
  CHARGE_CONFLICT:
    "The folio data was changed concurrently. Reload the page before adding another charge.",
  PAYMENT_CONFLICT:
    "The payment data was changed concurrently. Reload the page before trying again.",
  CHARGE_UNEXPECTED: "The charge could not be added. Please try again.",
  PAYMENT_UNEXPECTED: "The payment could not be recorded. Please try again.",
  RESULT_UNKNOWN:
    "The action result is uncertain. Reload the page before trying again.",
};

const forbiddenPublicTerms = [
  "Prisma",
  "database",
  "model",
  "selector",
  "serialization",
  "stack",
];

describe("folio failure contract", () => {
  it("has complete safe English copy for every stable folio failure code", () => {
    expect(new Set(FOLIO_FAILURE_CODES).size).toBe(FOLIO_FAILURE_CODES.length);
    expect(Object.keys(expectedMessages).sort()).toEqual(
      [...FOLIO_FAILURE_CODES].sort(),
    );

    for (const code of FOLIO_FAILURE_CODES) {
      const message = folioFailureMessage(code);

      expect(message).toBe(expectedMessages[code]);
      expect(message).toBe(FOLIO_FAILURE_MESSAGES[code]);

      for (const term of forbiddenPublicTerms) {
        expect(message.toLowerCase()).not.toContain(term.toLowerCase());
      }
    }
  });

  it("creates a properly shaped FolioFailure object", () => {
    const failure = folioFailure("FOLIO_NOT_FOUND");

    expect(failure).toEqual({
      ok: false,
      code: "FOLIO_NOT_FOUND",
      error: "Folio not found. Reload the page and try again.",
    });
  });

  describe("dialog UI state transitions", () => {
    it("initializes with no error and not uncertain", () => {
      expect(INITIAL_FOLIO_DIALOG_UI_STATE).toEqual({
        isUncertain: false,
        actionError: null,
        errorCode: null,
      });
    });

    it("resets state on action success", () => {
      const state = reduceFolioActionResult(
        {
          isUncertain: false,
          actionError: "Previous error",
          errorCode: "INVALID_INPUT",
        },
        { ok: true },
      );

      expect(state).toEqual(INITIAL_FOLIO_DIALOG_UI_STATE);
    });

    it("sets error and keeps submission possible on known failure", () => {
      const state = reduceFolioActionResult(
        INITIAL_FOLIO_DIALOG_UI_STATE,
        folioFailure("ARTICLE_NOT_FOUND"),
      );

      expect(state).toEqual({
        isUncertain: false,
        actionError:
          "The article was not found or is no longer available. Select another article.",
        errorCode: "ARTICLE_NOT_FOUND",
      });
    });

    it("locks submission into uncertain state on RESULT_UNKNOWN", () => {
      const state = reduceFolioActionResult(
        INITIAL_FOLIO_DIALOG_UI_STATE,
        folioFailure("RESULT_UNKNOWN"),
      );

      expect(state).toEqual({
        isUncertain: true,
        actionError:
          "The action result is uncertain. Reload the page before trying again.",
        errorCode: "RESULT_UNKNOWN",
      });
    });

    it("clears error on dialog close if not uncertain", () => {
      const state = reduceFolioDialogClose({
        isUncertain: false,
        actionError: "Beberapa input salah",
        errorCode: "INVALID_INPUT",
      });

      expect(state).toEqual(INITIAL_FOLIO_DIALOG_UI_STATE);
    });

    it("preserves uncertainty lock and error message on dialog close if uncertain", () => {
      const uncertainState = {
        isUncertain: true,
        actionError:
          "The action result is uncertain. Reload the page before trying again.",
        errorCode: "RESULT_UNKNOWN" as const,
      };

      const stateAfterClose = reduceFolioDialogClose(uncertainState);

      expect(stateAfterClose).toEqual(uncertainState);
      expect(stateAfterClose.isUncertain).toBe(true);
    });
  });
});
