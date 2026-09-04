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
  SESSION_EXPIRED: "Sesi Anda telah berakhir. Silakan masuk kembali.",
  FORBIDDEN: "Anda tidak memiliki izin untuk melakukan tindakan ini.",
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

const forbiddenPublicTerms = [
  "Prisma",
  "database",
  "model",
  "selector",
  "serialization",
  "stack",
  "charge", // Indonesian copy must not show the English word 'charge'
];

describe("folio failure contract", () => {
  it("has complete safe Indonesian copy for every stable folio failure code", () => {
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
      error: "Folio tidak ditemukan. Muat ulang halaman lalu coba lagi.",
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
          "Artikel tidak ditemukan atau sudah tidak tersedia. Pilih artikel lain.",
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
          "Hasil tindakan belum dapat dipastikan. Muat ulang halaman sebelum mencoba lagi.",
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
          "Hasil tindakan belum dapat dipastikan. Muat ulang halaman sebelum mencoba lagi.",
        errorCode: "RESULT_UNKNOWN" as const,
      };

      const stateAfterClose = reduceFolioDialogClose(uncertainState);

      expect(stateAfterClose).toEqual(uncertainState);
      expect(stateAfterClose.isUncertain).toBe(true);
    });
  });
});
