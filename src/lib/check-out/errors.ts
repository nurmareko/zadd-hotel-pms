import {
  checkActionAuthorization,
  logActionFailure,
  UNIVERSAL_ACTION_MESSAGES,
} from "@/lib/action-errors";
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
  "Hasil tindakan belum dapat dipastikan. Muat ulang halaman sebelum melakukan pembayaran atau check-out lagi.";

export const CHECKOUT_FAILURE_MESSAGES: Record<
  Exclude<CheckoutFailureCode, "BALANCE_DUE">,
  string
> = {
  SESSION_EXPIRED: UNIVERSAL_ACTION_MESSAGES.SESSION_EXPIRED,
  FORBIDDEN: UNIVERSAL_ACTION_MESSAGES.FORBIDDEN,
  INVALID_INPUT: "Data check-out tidak valid. Periksa kembali formulir.",
  FOLIO_NOT_FOUND:
    "Folio tidak ditemukan. Kembali ke reservasi dan muat ulang data.",
  SETTINGS_UNAVAILABLE:
    "Pengaturan hotel belum tersedia. Hubungi Administrator sebelum melanjutkan.",
  FOLIO_NOT_OPEN:
    "Pembayaran tidak dapat dicatat karena folio sudah tidak terbuka.",
  FOLIO_VOIDED:
    "Folio telah dibatalkan dan tidak dapat digunakan untuk check-out.",
  RESERVATION_NOT_CHECKED_IN:
    "Reservasi tidak lagi berstatus check-in. Muat ulang halaman dan periksa status terbaru.",
  BALANCE_ALREADY_SETTLED:
    "Sisa Tagihan sudah lunas. Muat ulang halaman untuk melanjutkan check-out.",
  PAYMENT_EXCEEDS_BALANCE:
    "Jumlah pembayaran melebihi Sisa Tagihan terbaru. Muat ulang lalu periksa jumlah pembayaran.",
  FOLIO_CHANGED:
    "Status folio berubah. Muat ulang halaman sebelum melanjutkan.",
  PAYMENT_CONFLICT:
    "Pembayaran final mengalami konflik data. Muat ulang halaman sebelum mencoba lagi.",
  CHECKOUT_CONFLICT:
    "Check-out mengalami konflik data. Muat ulang halaman dan periksa status terbaru.",
  FINAL_PAYMENT_UNEXPECTED:
    "Pembayaran final tidak dapat dicatat. Silakan coba lagi.",
  CHECKOUT_UNEXPECTED:
    "Check-out tidak dapat diselesaikan. Silakan coba lagi.",
  STAY_SCHEDULE_INCOMPLETE:
    "Jadwal Tarif masa inap belum lengkap. Lengkapi Tarif untuk setiap malam sebelum melanjutkan check-out.",
  STAY_SCHEDULE_OUT_OF_ORDER:
    "Urutan tanggal Tarif masa inap tidak sesuai. Perbaiki jadwal Tarif sebelum melanjutkan check-out.",
  STAY_NIGHT_OWNERSHIP_INVALID:
    "Salah satu Tarif malam terhubung ke reservasi yang tidak sesuai. Hentikan check-out dan minta pemeriksaan data.",
  ROOM_RATE_INVALID:
    "Tarif Kamar untuk salah satu malam tidak valid. Perbaiki Tarif sebelum melanjutkan check-out.",
  MEAL_VALUES_INCOMPLETE:
    "Data Inklusi makan untuk salah satu malam belum lengkap. Lengkapi atau hapus Inklusi tersebut sebelum check-out.",
  MEAL_VALUES_INVALID:
    "Data Inklusi makan untuk salah satu malam tidak valid. Perbaiki jumlah tamu dan nilai Inklusi sebelum check-out.",
  STAY_NIGHT_COUNT_INVALID:
    "Tanggal masa inap tidak dapat menghasilkan jumlah malam yang valid. Periksa tanggal reservasi.",
  STAY_SCHEDULE_SHORTFALL:
    "Tarif belum tersedia untuk seluruh malam yang sudah dijalani. Lengkapi jadwal Tarif sebelum check-out.",
  MEAL_PLAN_UNSUPPORTED:
    "Paket Inklusi untuk salah satu malam tidak dapat diposting. Pilih paket yang tersedia atau hapus Inklusi.",
  STAY_ARTICLE_MISSING:
    "Artikel charge menginap belum tersedia. Hubungi Administrator sebelum melanjutkan check-out.",
  STAY_POSTING_STATE_CHANGED:
    "Status folio atau reservasi berubah saat charge menginap diposting. Muat ulang halaman sebelum melanjutkan.",
  STAY_POSTING_CONFLICT:
    "Posting charge menginap mengalami konflik data. Muat ulang halaman sebelum mencoba lagi.",
  STAY_POSTING_UNEXPECTED:
    "Charge menginap tidak dapat diposting. Silakan coba lagi.",
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
      ? `Sisa Tagihan masih belum lunas (${options?.amount ?? "-"}). Catat pembayaran final terlebih dahulu.`
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
): CheckoutFailure | null {
  const failure = checkActionAuthorization(session, ["FO"]);
  return failure ? checkoutFailure(failure.code) : null;
}

const CHECKOUT_FIELD_MESSAGES: Record<string, string> = {
  folioId: "Folio wajib dipilih.",
  amount: "Jumlah pembayaran tidak valid.",
  method: "Metode pembayaran tidak valid.",
  reference: "Referensi pembayaran tidak valid.",
  confirmed: "Konfirmasi wajib dicentang sebelum check-out.",
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
