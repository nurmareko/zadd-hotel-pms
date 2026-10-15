import {
  checkActionAuthorization,
  UNIVERSAL_ACTION_MESSAGES,
  type ActionFailure,
  type ActionResult,
} from "@/lib/action-errors";
import type { Capability } from "@/lib/permissions";

export const CHECK_IN_FAILURE_CODES = [
  "SESSION_EXPIRED",
  "FORBIDDEN",
  "INVALID_INPUT",
  "RESERVATION_NOT_FOUND",
  "RESERVATION_NOT_ELIGIBLE",
  "ARRIVAL_NOT_DUE",
  "ROOM_REQUIRED",
  "ROOM_TYPE_MISMATCH",
  "ROOM_OOO",
  "ROOM_BLOCKED",
  "ROOM_UNAVAILABLE",
  "DEPOSIT_NOT_ELIGIBLE",
  "DEPOSIT_STATE_INCONSISTENT",
  "DEPOSIT_RATE_UNAVAILABLE",
  "DEPOSIT_REQUIRED",
  "DEPOSIT_FOLIO_MISSING",
  "DEPOSIT_CONFLICT",
  "DEPOSIT_UNEXPECTED",
  "GRC_INCOMPLETE",
  "RESERVATION_CHANGED",
  "STAY_FEE_UNAVAILABLE",
  "NIGHT_AUDIT_CLOSED",
  "CHECK_IN_CONFLICT",
  "CHECK_IN_UNEXPECTED",
  "REVIEW_UNEXPECTED",
  "RESULT_UNKNOWN",
] as const;

export type CheckInFailureCode = (typeof CHECK_IN_FAILURE_CODES)[number];

export type CheckInActionField =
  | "reservationId"
  | "roomId"
  | "guestFullName"
  | "guestIdType"
  | "guestIdNumber"
  | "guestPhone"
  | "guestEmail"
  | "guestNationality"
  | "purposeOfVisit"
  | "purposeOfVisitOther"
  | "signatureDataUrl"
  | "arrivalConfirmation"
  | "depositMethod"
  | "depositReference"
  | "groupBookingId"
  | string;

export type CheckInFailure = ActionFailure<
  CheckInFailureCode,
  CheckInActionField
>;

export type CheckInActionResult = ActionResult<
  CheckInFailureCode,
  CheckInActionField
>;

export const CHECK_IN_FAILURE_MESSAGES: Record<CheckInFailureCode, string> = {
  SESSION_EXPIRED: UNIVERSAL_ACTION_MESSAGES.SESSION_EXPIRED,
  FORBIDDEN: UNIVERSAL_ACTION_MESSAGES.FORBIDDEN,
  INVALID_INPUT: "Invalid check-in data. Please review the form.",
  RESERVATION_NOT_FOUND: "Reservation not found. Reload the page.",
  RESERVATION_NOT_ELIGIBLE:
    "This reservation is no longer eligible for check-in. Reload the page and check its status.",
  ARRIVAL_NOT_DUE: "Check-in is only available from the arrival date.",
  ROOM_REQUIRED: "Select a suitable room to continue check-in.",
  ROOM_TYPE_MISMATCH:
    "The selected room does not match the reserved room type. Select another room.",
  ROOM_OOO: "The selected room is OOO. Select another room.",
  ROOM_BLOCKED: "The selected room is blocked during this stay. Select another room.",
  ROOM_UNAVAILABLE: "The selected room is no longer available. Select another room.",
  DEPOSIT_NOT_ELIGIBLE:
    "A deposit cannot yet be collected for this reservation. Reload and check the reservation status.",
  DEPOSIT_STATE_INCONSISTENT:
    "The deposit status and folio payments are inconsistent. Stop and request a data review.",
  DEPOSIT_RATE_UNAVAILABLE:
    "The first-night rate is missing or invalid. Correct the rate before collecting a deposit.",
  DEPOSIT_REQUIRED:
    "The deposit has not been paid. Collect the deposit before check-in.",
  DEPOSIT_FOLIO_MISSING:
    "Deposit folio not found. Stop check-in and review the reservation data.",
  DEPOSIT_CONFLICT:
    "The deposit status was changed concurrently. Reload the page before trying again.",
  DEPOSIT_UNEXPECTED:
    "The deposit payment could not be recorded. Please try again.",
  GRC_INCOMPLETE:
    "Complete the GRC, guest signature, and arrival confirmation before check-in.",
  RESERVATION_CHANGED:
    "The reservation data has changed. Reload, review the GRC, and request a new signature.",
  STAY_FEE_UNAVAILABLE:
    "Stay flexibility fees could not be recorded. Check the fee settings and try again.",
  NIGHT_AUDIT_CLOSED:
    "Night Audit for the current business date is complete. Check-in cannot be processed.",
  CHECK_IN_CONFLICT:
    "Check-in encountered a data conflict. Reload the page and check the reservation and room status.",
  CHECK_IN_UNEXPECTED: "Check-in could not be completed. Please try again.",
  REVIEW_UNEXPECTED: "Check-in data could not be loaded. Please try again.",
  RESULT_UNKNOWN:
    "The action result is uncertain. Reload the page before trying again.",
};

export const CHECK_IN_UNKNOWN_RESULT_MESSAGES = {
  deposit:
    "The deposit payment result is uncertain. Reload the page before trying again.",
  checkIn:
    "The check-in result is uncertain. Reload the page before trying again.",
} as const;

export const GROUP_MUTATION_UNCERTAIN_MESSAGE =
  "The group operation result is uncertain. Some rooms may already have been processed. Reload the page before trying again.";

export function checkInFailureMessage(
  code: CheckInFailureCode,
  context?: "deposit" | "checkIn",
): string {
  if (code === "RESULT_UNKNOWN" && context) {
    return CHECK_IN_UNKNOWN_RESULT_MESSAGES[context];
  }
  return CHECK_IN_FAILURE_MESSAGES[code];
}

export function checkInFailure(
  code: CheckInFailureCode,
  options?: {
    field?: CheckInActionField;
    message?: string;
    context?: "deposit" | "checkIn";
  },
): CheckInFailure {
  const error =
    options?.message ??
    (options?.context && code === "RESULT_UNKNOWN"
      ? CHECK_IN_UNKNOWN_RESULT_MESSAGES[options.context]
      : CHECK_IN_FAILURE_MESSAGES[code]);

  return {
    ok: false,
    code,
    error,
    ...(options?.field ? { field: options.field } : {}),
  };
}

export function checkInAuthorizationFailure(
  session: { user?: { role?: string } } | null | undefined,
  capability: Capability | readonly string[] = "checkin:manage",
): CheckInFailure | null {
  const failure = checkActionAuthorization(session, capability);
  if (!failure) {
    return null;
  }

  return checkInFailure(failure.code as CheckInFailureCode);
}

export type CheckInUiState = {
  isUncertain: boolean;
  actionError: string | null;
  errorCode: CheckInFailureCode | null;
  errorField?: CheckInActionField | null;
};

export const INITIAL_CHECK_IN_UI_STATE: CheckInUiState = {
  isUncertain: false,
  actionError: null,
  errorCode: null,
  errorField: null,
};

export function reduceCheckInActionResult(
  currentState: CheckInUiState,
  result: { ok: true } | CheckInFailure,
  options?: { context?: "deposit" | "checkIn" },
): CheckInUiState {
  if (currentState.isUncertain) {
    return currentState;
  }

  if (result.ok) {
    return INITIAL_CHECK_IN_UI_STATE;
  }

  if (result.code === "RESULT_UNKNOWN") {
    return {
      isUncertain: true,
      actionError:
        options?.context &&
        result.error === CHECK_IN_FAILURE_MESSAGES.RESULT_UNKNOWN
          ? CHECK_IN_UNKNOWN_RESULT_MESSAGES[options.context]
          : result.error,
      errorCode: result.code,
      errorField: result.field ?? null,
    };
  }

  return {
    isUncertain: false,
    actionError: result.error,
    errorCode: result.code,
    errorField: result.field ?? null,
  };
}

export function reduceCheckInActionRejection(
  currentState: CheckInUiState,
  context: "deposit" | "checkIn" | "review",
): CheckInUiState {
  if (currentState.isUncertain) {
    return currentState;
  }

  if (context === "review") {
    return {
      isUncertain: false,
      actionError: CHECK_IN_FAILURE_MESSAGES.REVIEW_UNEXPECTED,
      errorCode: "REVIEW_UNEXPECTED",
      errorField: null,
    };
  }

  return {
    isUncertain: true,
    actionError: CHECK_IN_UNKNOWN_RESULT_MESSAGES[context],
    errorCode: "RESULT_UNKNOWN",
    errorField: null,
  };
}

export function reduceCheckInDialogClose(
  currentState: CheckInUiState,
): CheckInUiState {
  if (currentState.isUncertain) {
    return currentState;
  }

  return INITIAL_CHECK_IN_UI_STATE;
}
