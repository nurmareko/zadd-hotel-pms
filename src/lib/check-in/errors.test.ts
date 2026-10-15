import { describe, expect, it } from "vitest";

import {
  CHECK_IN_FAILURE_CODES,
  CHECK_IN_FAILURE_MESSAGES,
  CHECK_IN_UNKNOWN_RESULT_MESSAGES,
  GROUP_MUTATION_UNCERTAIN_MESSAGE,
  checkInAuthorizationFailure,
  checkInFailure,
  checkInFailureMessage,
  INITIAL_CHECK_IN_UI_STATE,
  reduceCheckInActionRejection,
  reduceCheckInActionResult,
  reduceCheckInDialogClose,
  type CheckInUiState,
} from "./errors";

describe("check-in error definitions and helpers", () => {
  it("provides messages for every supported failure code including dated blocks", () => {
    expect(CHECK_IN_FAILURE_CODES).toContain("ROOM_BLOCKED");
    expect(Object.keys(CHECK_IN_FAILURE_MESSAGES).sort()).toEqual([...CHECK_IN_FAILURE_CODES].sort());

    for (const code of CHECK_IN_FAILURE_CODES) {
      expect(CHECK_IN_FAILURE_MESSAGES[code]).toBeDefined();
      expect(typeof CHECK_IN_FAILURE_MESSAGES[code]).toBe("string");
      expect(CHECK_IN_FAILURE_MESSAGES[code].length).toBeGreaterThan(0);
    }
  });

  it("provides the specified controlled English messages", () => {
    expect(CHECK_IN_FAILURE_MESSAGES.SESSION_EXPIRED).toBe(
      "Your session has expired. Please sign in again.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.FORBIDDEN).toBe(
      "You do not have permission to perform this action.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.INVALID_INPUT).toBe(
      "Invalid check-in data. Please review the form.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.RESERVATION_NOT_FOUND).toBe(
      "Reservation not found. Reload the page.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.RESERVATION_NOT_ELIGIBLE).toBe(
      "This reservation is no longer eligible for check-in. Reload the page and check its status.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.ARRIVAL_NOT_DUE).toBe(
      "Check-in is only available from the arrival date.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.ROOM_REQUIRED).toBe(
      "Select a suitable room to continue check-in.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.ROOM_TYPE_MISMATCH).toBe(
      "The selected room does not match the reserved room type. Select another room.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.ROOM_OOO).toBe(
      "The selected room is OOO. Select another room.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.ROOM_UNAVAILABLE).toBe(
      "The selected room is no longer available. Select another room.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.DEPOSIT_NOT_ELIGIBLE).toBe(
      "A deposit cannot yet be collected for this reservation. Reload and check the reservation status.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.DEPOSIT_STATE_INCONSISTENT).toBe(
      "The deposit status and folio payments are inconsistent. Stop and request a data review.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.DEPOSIT_RATE_UNAVAILABLE).toBe(
      "The first-night rate is missing or invalid. Correct the rate before collecting a deposit.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.DEPOSIT_REQUIRED).toBe(
      "The deposit has not been paid. Collect the deposit before check-in.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.DEPOSIT_FOLIO_MISSING).toBe(
      "Deposit folio not found. Stop check-in and review the reservation data.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.DEPOSIT_CONFLICT).toBe(
      "The deposit status was changed concurrently. Reload the page before trying again.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.DEPOSIT_UNEXPECTED).toBe(
      "The deposit payment could not be recorded. Please try again.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.GRC_INCOMPLETE).toBe(
      "Complete the GRC, guest signature, and arrival confirmation before check-in.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.RESERVATION_CHANGED).toBe(
      "The reservation data has changed. Reload, review the GRC, and request a new signature.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.STAY_FEE_UNAVAILABLE).toBe(
      "Stay flexibility fees could not be recorded. Check the fee settings and try again.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.CHECK_IN_CONFLICT).toBe(
      "Check-in encountered a data conflict. Reload the page and check the reservation and room status.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.CHECK_IN_UNEXPECTED).toBe(
      "Check-in could not be completed. Please try again.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.REVIEW_UNEXPECTED).toBe(
      "Check-in data could not be loaded. Please try again.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.RESULT_UNKNOWN).toBe(
      "The action result is uncertain. Reload the page before trying again.",
    );
  });

  it("provides contextual uncertainty messages for rejected mutating actions", () => {
    expect(CHECK_IN_UNKNOWN_RESULT_MESSAGES.deposit).toBe(
      "The deposit payment result is uncertain. Reload the page before trying again.",
    );
    expect(CHECK_IN_UNKNOWN_RESULT_MESSAGES.checkIn).toBe(
      "The check-in result is uncertain. Reload the page before trying again.",
    );

    expect(checkInFailureMessage("RESULT_UNKNOWN", "deposit")).toBe(
      CHECK_IN_UNKNOWN_RESULT_MESSAGES.deposit,
    );
    expect(checkInFailureMessage("RESULT_UNKNOWN", "checkIn")).toBe(
      CHECK_IN_UNKNOWN_RESULT_MESSAGES.checkIn,
    );
    expect(checkInFailureMessage("RESULT_UNKNOWN")).toBe(
      CHECK_IN_FAILURE_MESSAGES.RESULT_UNKNOWN,
    );
    expect(GROUP_MUTATION_UNCERTAIN_MESSAGE).toBe(
      "The group operation result is uncertain. Some rooms may already have been processed. Reload the page before trying again.",
    );
  });

  it("builds checkInFailure objects accurately", () => {
    const defaultFailure = checkInFailure("ROOM_REQUIRED");
    expect(defaultFailure).toEqual({
      ok: false,
      code: "ROOM_REQUIRED",
      error: "Select a suitable room to continue check-in.",
    });

    const fieldFailure = checkInFailure("ROOM_TYPE_MISMATCH", {
      field: "roomId",
    });
    expect(fieldFailure).toEqual({
      ok: false,
      code: "ROOM_TYPE_MISMATCH",
      error:
        "The selected room does not match the reserved room type. Select another room.",
      field: "roomId",
    });

    const contextualFailure = checkInFailure("RESULT_UNKNOWN", {
      context: "checkIn",
    });
    expect(contextualFailure).toEqual({
      ok: false,
      code: "RESULT_UNKNOWN",
      error:
        "The check-in result is uncertain. Reload the page before trying again.",
    });

    const customMessageFailure = checkInFailure("INVALID_INPUT", {
      message: "Data kamar tidak valid",
    });
    expect(customMessageFailure).toEqual({
      ok: false,
      code: "INVALID_INPUT",
      error: "Data kamar tidak valid",
    });
  });

  it("checks action authorization using shared action-errors helper", () => {
    expect(checkInAuthorizationFailure(null)).toEqual({
      ok: false,
      code: "SESSION_EXPIRED",
      error: "Your session has expired. Please sign in again.",
    });

    expect(
      checkInAuthorizationFailure({ user: { role: "HK" } }, ["FO"]),
    ).toEqual({
      ok: false,
      code: "FORBIDDEN",
      error: "You do not have permission to perform this action.",
    });

    expect(
      checkInAuthorizationFailure({ user: { role: "FO" } }, ["FO"]),
    ).toBeNull();
  });
});

describe("check-in client UI state reducer", () => {
  it("initializes to clean state", () => {
    expect(INITIAL_CHECK_IN_UI_STATE).toEqual({
      isUncertain: false,
      actionError: null,
      errorCode: null,
      errorField: null,
    });
  });

  it("resets state on successful action result", () => {
    const dirtyState: CheckInUiState = {
      isUncertain: false,
      actionError: "Previous error",
      errorCode: "INVALID_INPUT",
      errorField: "roomId",
    };

    expect(reduceCheckInActionResult(dirtyState, { ok: true })).toEqual(
      INITIAL_CHECK_IN_UI_STATE,
    );
  });

  it("updates state on standard action failure", () => {
    const failure = checkInFailure("DEPOSIT_REQUIRED");
    const nextState = reduceCheckInActionResult(
      INITIAL_CHECK_IN_UI_STATE,
      failure,
    );

    expect(nextState).toEqual({
      isUncertain: false,
      actionError: "The deposit has not been paid. Collect the deposit before check-in.",
      errorCode: "DEPOSIT_REQUIRED",
      errorField: null,
    });
  });

  it("sets uncertain state on RESULT_UNKNOWN action result", () => {
    const failure = checkInFailure("RESULT_UNKNOWN");
    const nextState = reduceCheckInActionResult(
      INITIAL_CHECK_IN_UI_STATE,
      failure,
      { context: "deposit" },
    );

    expect(nextState).toEqual({
      isUncertain: true,
      actionError:
        "The deposit payment result is uncertain. Reload the page before trying again.",
      errorCode: "RESULT_UNKNOWN",
      errorField: null,
    });
  });

  it("handles promise rejection for read-only review without locking mutating actions", () => {
    const state = reduceCheckInActionRejection(
      INITIAL_CHECK_IN_UI_STATE,
      "review",
    );

    expect(state).toEqual({
      isUncertain: false,
      actionError: "Check-in data could not be loaded. Please try again.",
      errorCode: "REVIEW_UNEXPECTED",
      errorField: null,
    });
  });

  it("handles promise rejection for deposit and check-in with uncertainty lock", () => {
    const depositState = reduceCheckInActionRejection(
      INITIAL_CHECK_IN_UI_STATE,
      "deposit",
    );
    expect(depositState).toEqual({
      isUncertain: true,
      actionError:
        "The deposit payment result is uncertain. Reload the page before trying again.",
      errorCode: "RESULT_UNKNOWN",
      errorField: null,
    });

    const checkInState = reduceCheckInActionRejection(
      INITIAL_CHECK_IN_UI_STATE,
      "checkIn",
    );
    expect(checkInState).toEqual({
      isUncertain: true,
      actionError:
        "The check-in result is uncertain. Reload the page before trying again.",
      errorCode: "RESULT_UNKNOWN",
      errorField: null,
    });
  });

  it("prevents clearing uncertain state on dialog close, but clears standard errors", () => {
    const standardErrorState: CheckInUiState = {
      isUncertain: false,
      actionError: "Some error",
      errorCode: "ROOM_UNAVAILABLE",
      errorField: "roomId",
    };
    expect(reduceCheckInDialogClose(standardErrorState)).toEqual(
      INITIAL_CHECK_IN_UI_STATE,
    );

    const uncertainState: CheckInUiState = {
      isUncertain: true,
      actionError:
        "The check-in result is uncertain. Reload the page before trying again.",
      errorCode: "RESULT_UNKNOWN",
      errorField: null,
    };
    expect(reduceCheckInDialogClose(uncertainState)).toEqual(uncertainState);
  });

  it("locks uncertainty against subsequent successful or failed action results", () => {
    const uncertainState: CheckInUiState = {
      isUncertain: true,
      actionError:
        "The check-in result is uncertain. Reload the page before trying again.",
      errorCode: "RESULT_UNKNOWN",
      errorField: null,
    };

    expect(reduceCheckInActionResult(uncertainState, { ok: true })).toEqual(
      uncertainState,
    );
    expect(
      reduceCheckInActionResult(
        uncertainState,
        checkInFailure("DEPOSIT_REQUIRED"),
      ),
    ).toEqual(uncertainState);
    expect(reduceCheckInActionRejection(uncertainState, "deposit")).toEqual(
      uncertainState,
    );
    expect(reduceCheckInActionRejection(uncertainState, "review")).toEqual(
      uncertainState,
    );
  });
});
