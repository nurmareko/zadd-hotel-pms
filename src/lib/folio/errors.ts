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
  INVALID_INPUT: "Data folio tidak valid. Periksa kembali formulir.",
  FOLIO_NOT_FOUND:
    "Folio tidak ditemukan. Muat ulang halaman lalu coba lagi.",
  FOLIO_NOT_OPEN:
    "Folio sudah tidak terbuka. Muat ulang halaman untuk melihat status terbaru.",
  ARTICLE_NOT_FOUND:
    "Artikel tidak ditemukan atau sudah tidak tersedia. Pilih artikel lain.",
  PROTECTED_TAX_ARTICLE:
    "Pajak dihitung otomatis dan tidak dapat ditambahkan secara manual.",
  PROTECTED_STAY_ARTICLE:
    "Tagihan menginap ini dicatat otomatis dan tidak dapat ditambahkan secara manual.",
  CHARGE_CONFLICT:
    "Data folio berubah bersamaan. Muat ulang halaman sebelum menambahkan tagihan lagi.",
  PAYMENT_CONFLICT:
    "Data pembayaran berubah bersamaan. Muat ulang halaman sebelum mencoba lagi.",
  CHARGE_UNEXPECTED: "Tagihan tidak dapat ditambahkan. Silakan coba lagi.",
  PAYMENT_UNEXPECTED: "Pembayaran tidak dapat dicatat. Silakan coba lagi.",
  RESULT_UNKNOWN:
    "Hasil tindakan belum dapat dipastikan. Muat ulang halaman sebelum mencoba lagi.",
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
