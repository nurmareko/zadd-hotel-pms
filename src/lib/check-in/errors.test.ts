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
  it("contains exactly the 24 supported failure codes", () => {
    expect(CHECK_IN_FAILURE_CODES).toHaveLength(24);
    expect(Object.keys(CHECK_IN_FAILURE_MESSAGES)).toHaveLength(24);

    for (const code of CHECK_IN_FAILURE_CODES) {
      expect(CHECK_IN_FAILURE_MESSAGES[code]).toBeDefined();
      expect(typeof CHECK_IN_FAILURE_MESSAGES[code]).toBe("string");
      expect(CHECK_IN_FAILURE_MESSAGES[code].length).toBeGreaterThan(0);
    }
  });

  it("provides the specified controlled Indonesian messages", () => {
    expect(CHECK_IN_FAILURE_MESSAGES.SESSION_EXPIRED).toBe(
      "Sesi Anda telah berakhir. Silakan masuk kembali.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.FORBIDDEN).toBe(
      "Anda tidak memiliki izin untuk melakukan tindakan ini.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.INVALID_INPUT).toBe(
      "Data check-in tidak valid. Periksa kembali formulir.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.RESERVATION_NOT_FOUND).toBe(
      "Reservasi tidak ditemukan. Muat ulang halaman.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.RESERVATION_NOT_ELIGIBLE).toBe(
      "Reservasi tidak lagi memenuhi syarat check-in. Muat ulang halaman dan periksa statusnya.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.ARRIVAL_NOT_DUE).toBe(
      "Check-in baru dapat dilakukan pada tanggal kedatangan.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.ROOM_REQUIRED).toBe(
      "Pilih kamar yang sesuai untuk melanjutkan check-in.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.ROOM_TYPE_MISMATCH).toBe(
      "Kamar yang dipilih tidak sesuai dengan tipe kamar reservasi. Pilih kamar lain.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.ROOM_OOO).toBe(
      "Kamar yang dipilih berstatus OOO. Pilih kamar lain.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.ROOM_UNAVAILABLE).toBe(
      "Kamar yang dipilih sudah tidak tersedia. Pilih kamar lain.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.DEPOSIT_NOT_ELIGIBLE).toBe(
      "Deposit belum dapat dikumpulkan untuk reservasi ini. Muat ulang dan periksa status reservasi.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.DEPOSIT_STATE_INCONSISTENT).toBe(
      "Status deposit dan pembayaran folio tidak sesuai. Hentikan proses dan minta pemeriksaan data.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.DEPOSIT_RATE_UNAVAILABLE).toBe(
      "Tarif malam pertama belum tersedia atau tidak valid. Perbaiki tarif sebelum mengumpulkan deposit.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.DEPOSIT_REQUIRED).toBe(
      "Deposit belum dibayar. Kumpulkan deposit sebelum check-in.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.DEPOSIT_FOLIO_MISSING).toBe(
      "Folio deposit tidak ditemukan. Hentikan check-in dan periksa data reservasi.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.DEPOSIT_CONFLICT).toBe(
      "Status deposit berubah bersamaan. Muat ulang halaman sebelum mencoba lagi.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.DEPOSIT_UNEXPECTED).toBe(
      "Pembayaran deposit tidak dapat dicatat. Silakan coba lagi.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.GRC_INCOMPLETE).toBe(
      "Lengkapi GRC, tanda tangan tamu, dan konfirmasi kedatangan sebelum check-in.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.RESERVATION_CHANGED).toBe(
      "Data reservasi berubah. Muat ulang, tinjau kembali GRC, lalu minta tanda tangan ulang.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.STAY_FEE_UNAVAILABLE).toBe(
      "Biaya fleksibilitas belum dapat dicatat. Periksa konfigurasi biaya lalu coba lagi.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.CHECK_IN_CONFLICT).toBe(
      "Check-in mengalami konflik data. Muat ulang halaman dan periksa status reservasi serta kamar.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.CHECK_IN_UNEXPECTED).toBe(
      "Check-in tidak dapat diselesaikan. Silakan coba lagi.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.REVIEW_UNEXPECTED).toBe(
      "Data check-in tidak dapat dimuat. Silakan coba lagi.",
    );
    expect(CHECK_IN_FAILURE_MESSAGES.RESULT_UNKNOWN).toBe(
      "Hasil tindakan belum dapat dipastikan. Muat ulang halaman sebelum mencoba lagi.",
    );
  });

  it("provides contextual uncertainty messages for rejected mutating actions", () => {
    expect(CHECK_IN_UNKNOWN_RESULT_MESSAGES.deposit).toBe(
      "Hasil pembayaran deposit belum dapat dipastikan. Muat ulang halaman sebelum mencoba lagi.",
    );
    expect(CHECK_IN_UNKNOWN_RESULT_MESSAGES.checkIn).toBe(
      "Hasil check-in belum dapat dipastikan. Muat ulang halaman sebelum mencoba lagi.",
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
      "Hasil proses grup belum dapat dipastikan. Beberapa kamar mungkin sudah diproses. Muat ulang halaman sebelum mencoba lagi.",
    );
  });

  it("builds checkInFailure objects accurately", () => {
    const defaultFailure = checkInFailure("ROOM_REQUIRED");
    expect(defaultFailure).toEqual({
      ok: false,
      code: "ROOM_REQUIRED",
      error: "Pilih kamar yang sesuai untuk melanjutkan check-in.",
    });

    const fieldFailure = checkInFailure("ROOM_TYPE_MISMATCH", {
      field: "roomId",
    });
    expect(fieldFailure).toEqual({
      ok: false,
      code: "ROOM_TYPE_MISMATCH",
      error:
        "Kamar yang dipilih tidak sesuai dengan tipe kamar reservasi. Pilih kamar lain.",
      field: "roomId",
    });

    const contextualFailure = checkInFailure("RESULT_UNKNOWN", {
      context: "checkIn",
    });
    expect(contextualFailure).toEqual({
      ok: false,
      code: "RESULT_UNKNOWN",
      error:
        "Hasil check-in belum dapat dipastikan. Muat ulang halaman sebelum mencoba lagi.",
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
      error: "Sesi Anda telah berakhir. Silakan masuk kembali.",
    });

    expect(
      checkInAuthorizationFailure({ user: { role: "HK" } }, ["FO"]),
    ).toEqual({
      ok: false,
      code: "FORBIDDEN",
      error: "Anda tidak memiliki izin untuk melakukan tindakan ini.",
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
      actionError: "Deposit belum dibayar. Kumpulkan deposit sebelum check-in.",
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
        "Hasil pembayaran deposit belum dapat dipastikan. Muat ulang halaman sebelum mencoba lagi.",
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
      actionError: "Data check-in tidak dapat dimuat. Silakan coba lagi.",
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
        "Hasil pembayaran deposit belum dapat dipastikan. Muat ulang halaman sebelum mencoba lagi.",
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
        "Hasil check-in belum dapat dipastikan. Muat ulang halaman sebelum mencoba lagi.",
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
        "Hasil check-in belum dapat dipastikan. Muat ulang halaman sebelum mencoba lagi.",
      errorCode: "RESULT_UNKNOWN",
      errorField: null,
    };
    expect(reduceCheckInDialogClose(uncertainState)).toEqual(uncertainState);
  });

  it("locks uncertainty against subsequent successful or failed action results", () => {
    const uncertainState: CheckInUiState = {
      isUncertain: true,
      actionError:
        "Hasil check-in belum dapat dipastikan. Muat ulang halaman sebelum mencoba lagi.",
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
