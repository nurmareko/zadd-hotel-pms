import {
  checkActionAuthorization,
  UNIVERSAL_ACTION_MESSAGES,
  type ActionFailure,
  type ActionResult,
} from "@/lib/action-errors";

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
  INVALID_INPUT: "Data check-in tidak valid. Periksa kembali formulir.",
  RESERVATION_NOT_FOUND: "Reservasi tidak ditemukan. Muat ulang halaman.",
  RESERVATION_NOT_ELIGIBLE:
    "Reservasi tidak lagi memenuhi syarat check-in. Muat ulang halaman dan periksa statusnya.",
  ARRIVAL_NOT_DUE: "Check-in baru dapat dilakukan pada tanggal kedatangan.",
  ROOM_REQUIRED: "Pilih kamar yang sesuai untuk melanjutkan check-in.",
  ROOM_TYPE_MISMATCH:
    "Kamar yang dipilih tidak sesuai dengan tipe kamar reservasi. Pilih kamar lain.",
  ROOM_OOO: "Kamar yang dipilih berstatus OOO. Pilih kamar lain.",
  ROOM_UNAVAILABLE: "Kamar yang dipilih sudah tidak tersedia. Pilih kamar lain.",
  DEPOSIT_NOT_ELIGIBLE:
    "Deposit belum dapat dikumpulkan untuk reservasi ini. Muat ulang dan periksa status reservasi.",
  DEPOSIT_STATE_INCONSISTENT:
    "Status deposit dan pembayaran folio tidak sesuai. Hentikan proses dan minta pemeriksaan data.",
  DEPOSIT_RATE_UNAVAILABLE:
    "Tarif malam pertama belum tersedia atau tidak valid. Perbaiki tarif sebelum mengumpulkan deposit.",
  DEPOSIT_REQUIRED:
    "Deposit belum dibayar. Kumpulkan deposit sebelum check-in.",
  DEPOSIT_FOLIO_MISSING:
    "Folio deposit tidak ditemukan. Hentikan check-in dan periksa data reservasi.",
  DEPOSIT_CONFLICT:
    "Status deposit berubah bersamaan. Muat ulang halaman sebelum mencoba lagi.",
  DEPOSIT_UNEXPECTED:
    "Pembayaran deposit tidak dapat dicatat. Silakan coba lagi.",
  GRC_INCOMPLETE:
    "Lengkapi GRC, tanda tangan tamu, dan konfirmasi kedatangan sebelum check-in.",
  RESERVATION_CHANGED:
    "Data reservasi berubah. Muat ulang, tinjau kembali GRC, lalu minta tanda tangan ulang.",
  STAY_FEE_UNAVAILABLE:
    "Biaya fleksibilitas belum dapat dicatat. Periksa konfigurasi biaya lalu coba lagi.",
  CHECK_IN_CONFLICT:
    "Check-in mengalami konflik data. Muat ulang halaman dan periksa status reservasi serta kamar.",
  CHECK_IN_UNEXPECTED: "Check-in tidak dapat diselesaikan. Silakan coba lagi.",
  REVIEW_UNEXPECTED: "Data check-in tidak dapat dimuat. Silakan coba lagi.",
  RESULT_UNKNOWN:
    "Hasil tindakan belum dapat dipastikan. Muat ulang halaman sebelum mencoba lagi.",
};

export const CHECK_IN_UNKNOWN_RESULT_MESSAGES = {
  deposit:
    "Hasil pembayaran deposit belum dapat dipastikan. Muat ulang halaman sebelum mencoba lagi.",
  checkIn:
    "Hasil check-in belum dapat dipastikan. Muat ulang halaman sebelum mencoba lagi.",
} as const;

export const GROUP_MUTATION_UNCERTAIN_MESSAGE =
  "Hasil proses grup belum dapat dipastikan. Beberapa kamar mungkin sudah diproses. Muat ulang halaman sebelum mencoba lagi.";

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
  allowedRoles: readonly string[] = ["FO"],
): CheckInFailure | null {
  const failure = checkActionAuthorization(session, allowedRoles);
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
