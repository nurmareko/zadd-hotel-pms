import {
  UNIVERSAL_ACTION_MESSAGES,
  type ActionFailure,
  type ActionResult,
} from "@/lib/action-errors";

export const FOLIO_FAILURE_CODES = [
  "SESSION_EXPIRED",
  "FORBIDDEN",
  "INVALID_INPUT",
  "FOLIO_NOT_FOUND",
  "FOLIO_NOT_OPEN",
  "NIGHT_AUDIT_CLOSED",
  "ARTICLE_NOT_FOUND",
  "PROTECTED_TAX_ARTICLE",
  "PROTECTED_STAY_ARTICLE",
  "CHARGE_CONFLICT",
  "PAYMENT_CONFLICT",
  "CHARGE_UNEXPECTED",
  "PAYMENT_UNEXPECTED",
  "RESULT_UNKNOWN",
] as const;

export type FolioFailureCode = (typeof FOLIO_FAILURE_CODES)[number];

export type FolioFailure = ActionFailure<FolioFailureCode>;

export type FolioActionResult = ActionResult<FolioFailureCode>;

export const FOLIO_FAILURE_MESSAGES: Record<FolioFailureCode, string> = {
  SESSION_EXPIRED: UNIVERSAL_ACTION_MESSAGES.SESSION_EXPIRED,
  FORBIDDEN: UNIVERSAL_ACTION_MESSAGES.FORBIDDEN,
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

export function folioFailureMessage(code: FolioFailureCode): string {
  return FOLIO_FAILURE_MESSAGES[code];
}

export function folioFailure(code: FolioFailureCode): FolioFailure {
  return {
    ok: false,
    code,
    error: FOLIO_FAILURE_MESSAGES[code],
  };
}

export type FolioDialogUiState = {
  isUncertain: boolean;
  actionError: string | null;
  errorCode: FolioFailureCode | null;
};

export const INITIAL_FOLIO_DIALOG_UI_STATE: FolioDialogUiState = {
  isUncertain: false,
  actionError: null,
  errorCode: null,
};

export function reduceFolioActionResult(
  currentState: FolioDialogUiState,
  result: FolioActionResult,
): FolioDialogUiState {
  if (result.ok) {
    return INITIAL_FOLIO_DIALOG_UI_STATE;
  }

  if (result.code === "RESULT_UNKNOWN") {
    return {
      isUncertain: true,
      actionError: result.error,
      errorCode: result.code,
    };
  }

  return {
    isUncertain: false,
    actionError: result.error,
    errorCode: result.code,
  };
}

export function reduceFolioDialogClose(
  currentState: FolioDialogUiState,
): FolioDialogUiState {
  if (currentState.isUncertain) {
    return currentState;
  }

  return INITIAL_FOLIO_DIALOG_UI_STATE;
}
