import {
  checkActionAuthorization,
  logActionFailure,
  UNIVERSAL_ACTION_MESSAGES,
} from "@/lib/action-errors";
import type { Capability } from "@/lib/permissions";
import {
  StayChargePostingError,
  type StayChargePostingBlocker,
} from "@/lib/stay-charges";

export const CHECKOUT_FAILURE_CODES = [
  "SESSION_EXPIRED",
  "FORBIDDEN",
  "INVALID_INPUT",
  "FOLIO_NOT_FOUND",
  "SETTINGS_UNAVAILABLE",
  "FOLIO_NOT_OPEN",
  "FOLIO_VOIDED",
  "RESERVATION_NOT_CHECKED_IN",
  "BALANCE_ALREADY_SETTLED",
  "PAYMENT_EXCEEDS_BALANCE",
  "BALANCE_DUE",
  "FOLIO_CHANGED",
  "PAYMENT_CONFLICT",
  "CHECKOUT_CONFLICT",
  "FINAL_PAYMENT_UNEXPECTED",
  "CHECKOUT_UNEXPECTED",
  "STAY_SCHEDULE_INCOMPLETE",
  "STAY_SCHEDULE_OUT_OF_ORDER",
  "STAY_NIGHT_OWNERSHIP_INVALID",
  "ROOM_RATE_INVALID",
  "INVALID_STAY_CHARGE_AMOUNT",
  "MEAL_VALUES_INCOMPLETE",
  "MEAL_VALUES_INVALID",
  "STAY_NIGHT_COUNT_INVALID",
  "STAY_SCHEDULE_SHORTFALL",
  "MEAL_PLAN_UNSUPPORTED",
  "STAY_ARTICLE_MISSING",
  "STAY_POSTING_STATE_CHANGED",
  "STAY_POSTING_CONFLICT",
  "STAY_POSTING_UNEXPECTED",
  "RESULT_UNKNOWN",
] as const;

export type CheckoutFailureCode = (typeof CHECKOUT_FAILURE_CODES)[number];

export type CheckoutFailure = {
  ok: false;
  code: CheckoutFailureCode;
  error: string;
  fieldErrors?: Record<string, string[]>;
};

export type CheckoutActionResult<TSuccess extends { ok: true } = { ok: true }> =
  | TSuccess
  | CheckoutFailure;

export const CHECKOUT_UNKNOWN_RESULT_MESSAGE =
  "The action result is uncertain. Reload the page before making another payment or attempting check-out again.";

export const CHECKOUT_FAILURE_MESSAGES: Record<
  Exclude<CheckoutFailureCode, "BALANCE_DUE">,
  string
> = {
  SESSION_EXPIRED: UNIVERSAL_ACTION_MESSAGES.SESSION_EXPIRED,
  FORBIDDEN: UNIVERSAL_ACTION_MESSAGES.FORBIDDEN,
  INVALID_INPUT: "Invalid check-out data. Please review the form.",
  FOLIO_NOT_FOUND:
    "Folio not found. Return to the reservation and reload the data.",
  SETTINGS_UNAVAILABLE:
    "Hotel settings are unavailable. Contact an administrator before continuing.",
  FOLIO_NOT_OPEN:
    "Payment cannot be recorded because the folio is no longer open.",
  FOLIO_VOIDED:
    "The folio has been voided and cannot be used for check-out.",
  RESERVATION_NOT_CHECKED_IN:
    "The reservation is no longer checked in. Reload the page and check its current status.",
  BALANCE_ALREADY_SETTLED:
    "The outstanding balance is already settled. Reload the page to continue check-out.",
  PAYMENT_EXCEEDS_BALANCE:
    "The payment exceeds the current outstanding balance. Reload and check the payment amount.",
  FOLIO_CHANGED:
    "The folio status has changed. Reload the page before continuing.",
  PAYMENT_CONFLICT:
    "Final payment encountered a data conflict. Reload the page before trying again.",
  CHECKOUT_CONFLICT:
    "Check-out encountered a data conflict. Reload the page and check the current status.",
  FINAL_PAYMENT_UNEXPECTED:
    "Final payment could not be recorded. Please try again.",
  CHECKOUT_UNEXPECTED:
    "Check-out could not be completed. Please try again.",
  STAY_SCHEDULE_INCOMPLETE:
    "The stay rate schedule is incomplete. Enter a rate for every night before continuing check-out.",
  STAY_SCHEDULE_OUT_OF_ORDER:
    "The stay rate dates are out of order. Correct the rate schedule before continuing check-out.",
  STAY_NIGHT_OWNERSHIP_INVALID:
    "A nightly rate belongs to a different reservation. Stop check-out and request a data review.",
  ROOM_RATE_INVALID:
    "A nightly room rate is invalid. Correct the rate before continuing check-out.",
  INVALID_STAY_CHARGE_AMOUNT:
    "A nightly Arrangement allocation exceeds the package rate, making the room amount negative. Correct the package rate or Arrangement allocation before continuing check-out.",
  MEAL_VALUES_INCOMPLETE:
    "Meal inclusion data for a night is incomplete. Complete or remove the inclusion before check-out.",
  MEAL_VALUES_INVALID:
    "Meal inclusion data for a night is invalid. Correct the guest count and inclusion amounts before check-out.",
  STAY_NIGHT_COUNT_INVALID:
    "The stay dates do not produce a valid night count. Check the reservation dates.",
  STAY_SCHEDULE_SHORTFALL:
    "Rates are missing for some nights already stayed. Complete the rate schedule before check-out.",
  MEAL_PLAN_UNSUPPORTED:
    "A nightly inclusion package cannot be posted. Select an available package or remove the inclusion.",
  STAY_ARTICLE_MISSING:
    "A stay-charge article is unavailable. Contact an administrator before continuing check-out.",
  STAY_POSTING_STATE_CHANGED:
    "The folio or reservation status changed while posting stay charges. Reload the page before continuing.",
  STAY_POSTING_CONFLICT:
    "Stay-charge posting encountered a data conflict. Reload the page before trying again.",
  STAY_POSTING_UNEXPECTED:
    "Stay charges could not be posted. Please try again.",
  RESULT_UNKNOWN: CHECKOUT_UNKNOWN_RESULT_MESSAGE,
};

export function checkoutFailure(
  code: CheckoutFailureCode,
  options?: {
    amount?: string;
    fieldErrors?: Record<string, string[]>;
  },
): CheckoutFailure {
  const error =
    code === "BALANCE_DUE"
      ? `The outstanding balance is not yet settled (${options?.amount ?? "-"}). Record the final payment first.`
      : CHECKOUT_FAILURE_MESSAGES[code];

  return {
    ok: false,
    code,
    error,
    ...(options?.fieldErrors && Object.keys(options.fieldErrors).length > 0
      ? { fieldErrors: options.fieldErrors }
      : {}),
  };
}

export function checkoutAuthorizationFailure(
  session: { user?: { role?: string } } | null | undefined,
  capability: Capability = "checkout:manage",
): CheckoutFailure | null {
  const failure = checkActionAuthorization(session, capability);
  return failure ? checkoutFailure(failure.code) : null;
}

const CHECKOUT_FIELD_MESSAGES: Record<string, string> = {
  folioId: "Select a folio.",
  amount: "Invalid payment amount.",
  method: "Invalid payment method.",
  reference: "Invalid payment reference.",
  confirmed: "Confirmation is required before check-out.",
};

export function checkoutValidationFailure(error: {
  issues: Array<{ path: PropertyKey[] }>;
}): CheckoutFailure {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const field = typeof issue.path[0] === "string" ? issue.path[0] : null;
    if (!field || !(field in CHECKOUT_FIELD_MESSAGES)) continue;

    const message = CHECKOUT_FIELD_MESSAGES[field];
    if (!fieldErrors[field]?.includes(message)) {
      fieldErrors[field] = [...(fieldErrors[field] ?? []), message];
    }
  }

  return checkoutFailure("INVALID_INPUT", { fieldErrors });
}

const STAY_BLOCKER_CODES: Record<
  StayChargePostingBlocker["kind"],
  CheckoutFailureCode
> = {
  INCOMPLETE_STAY_SCHEDULE: "STAY_SCHEDULE_INCOMPLETE",
  OUT_OF_ORDER_STAY_SCHEDULE: "STAY_SCHEDULE_OUT_OF_ORDER",
  NIGHT_OWNERSHIP_MISMATCH: "STAY_NIGHT_OWNERSHIP_INVALID",
  INVALID_ROOM_RATE: "ROOM_RATE_INVALID",
  INVALID_STAY_CHARGE_AMOUNT: "INVALID_STAY_CHARGE_AMOUNT",
  INCOMPLETE_MEAL_VALUES: "MEAL_VALUES_INCOMPLETE",
  INVALID_MEAL_VALUES: "MEAL_VALUES_INVALID",
  INVALID_EXPECTED_NIGHT_COUNT: "STAY_NIGHT_COUNT_INVALID",
  STAY_SCHEDULE_SHORTFALL: "STAY_SCHEDULE_SHORTFALL",
  UNSUPPORTED_MEAL_PLAN: "MEAL_PLAN_UNSUPPORTED",
  MISSING_STAY_CHARGE_ARTICLE: "STAY_ARTICLE_MISSING",
};

export function checkoutStayChargeFailure(
  error: StayChargePostingError,
  context?: { action?: string; stage?: string },
): CheckoutFailure {
  logActionFailure("checkout:stayChargePosting", error, {
    ...context,
    blocker: error.blocker,
  });

  return checkoutFailure(
    error.blocker
      ? STAY_BLOCKER_CODES[error.blocker.kind]
      : "STAY_POSTING_UNEXPECTED",
  );
}

export type CheckoutUiState = {
  isUncertain: boolean;
  isCommitted: boolean;
  actionError: string | null;
  fieldErrors: Record<string, string[]>;
};

export const INITIAL_CHECKOUT_UI_STATE: CheckoutUiState = {
  isUncertain: false,
  isCommitted: false,
  actionError: null,
  fieldErrors: {},
};

const COMMITTED_CHECKOUT_UI_STATE: CheckoutUiState = {
  isUncertain: false,
  isCommitted: true,
  actionError: null,
  fieldErrors: {},
};

export type MutationGuardState =
  | "idle"
  | "in-flight"
  | "uncertain"
  | "committed";

export type MutationGuard = {
  readonly state: MutationGuardState;
  tryAcquireAction: () => boolean;
  latchUncertainAction: () => void;
  latchCommittedAction: () => void;
  releaseKnownAction: () => void;
};

export function createMutationGuard(): MutationGuard {
  let state: MutationGuardState = "idle";

  return {
    get state() {
      return state;
    },
    tryAcquireAction() {
      if (state !== "idle") return false;
      state = "in-flight";
      return true;
    },
    latchUncertainAction() {
      if (state === "in-flight") state = "uncertain";
    },
    latchCommittedAction() {
      if (state === "in-flight") state = "committed";
    },
    releaseKnownAction() {
      if (state === "in-flight") state = "idle";
    },
  };
}

export function reduceCheckoutActionResult(
  currentState: CheckoutUiState,
  result: CheckoutActionResult,
): CheckoutUiState {
  if (currentState.isUncertain || currentState.isCommitted) return currentState;
  if (result.ok) return COMMITTED_CHECKOUT_UI_STATE;

  return {
    isUncertain: result.code === "RESULT_UNKNOWN",
    isCommitted: false,
    actionError: result.error,
    fieldErrors: result.fieldErrors ?? {},
  };
}

export function reduceCheckoutActionRejection(
  currentState: CheckoutUiState,
): CheckoutUiState {
  return currentState.isUncertain || currentState.isCommitted
    ? currentState
    : {
        isUncertain: true,
        isCommitted: false,
        actionError: CHECKOUT_UNKNOWN_RESULT_MESSAGE,
        fieldErrors: {},
      };
}

export type CheckoutMutationEffects = {
  applyState: (state: CheckoutUiState) => void;
  notifySuccess: () => void;
  refresh: () => void;
};

function runCheckoutConfirmedSuccessEffect(
  sideEffect: "outcome-rendering" | "notification" | "refresh-or-navigation",
  effect: () => void,
) {
  try {
    effect();
  } catch {
    try {
      console.error("[CheckoutClient] Confirmed-success follow-up failed", {
        sideEffect,
      });
    } catch {
      // Logging must not prevent the remaining post-commit effects.
    }
  }
}

export async function runCheckoutMutation(
  guard: MutationGuard,
  currentState: CheckoutUiState,
  action: () => Promise<CheckoutActionResult>,
  effects: CheckoutMutationEffects,
): Promise<"applied" | "blocked" | "discarded"> {
  if (!guard.tryAcquireAction()) return "blocked";

  let result: CheckoutActionResult;
  try {
    result = await action();
  } catch {
    guard.latchUncertainAction();
    effects.applyState(reduceCheckoutActionRejection(currentState));
    return "applied";
  }

  if (guard.state !== "in-flight") return "discarded";

  const nextState = reduceCheckoutActionResult(currentState, result);
  if (nextState.isUncertain) {
    guard.latchUncertainAction();
    effects.applyState(nextState);
    return "applied";
  }

  if (result.ok) {
    guard.latchCommittedAction();
    runCheckoutConfirmedSuccessEffect("outcome-rendering", () => {
      effects.applyState(nextState);
    });
    runCheckoutConfirmedSuccessEffect("notification", effects.notifySuccess);
    runCheckoutConfirmedSuccessEffect(
      "refresh-or-navigation",
      effects.refresh,
    );
    return "applied";
  }

  try {
    effects.applyState(nextState);
  } finally {
    guard.releaseKnownAction();
  }

  return "applied";
}

export function checkoutErrorPresentation(
  state: CheckoutUiState,
  hasTargetedFieldError: boolean,
) {
  return {
    showActionError: Boolean(state.actionError) && !hasTargetedFieldError,
    showReload: state.isUncertain,
  };
}

export function reloadCheckoutPage(reload = () => window.location.reload()) {
  reload();
}
