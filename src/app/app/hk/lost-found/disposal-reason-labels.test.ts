import { describe, expect, it } from "vitest";
import { DISPOSAL_REASON_LABELS, disposalReasonLabel } from "./disposal-reason-labels";

describe("disposalReasonLabel", () => {
  const reasons = [
    ["Masa simpan berakhir", "Retention period expired"],
    ["Dihibahkan ke yayasan", "Donated to charity"],
    ["Dimusnahkan karena rusak/kedaluwarsa", "Disposed of due to damage / expiry"],
  ] as const;

  it("preserves the predefined submitted values and English option labels", () => {
    expect(Object.entries(DISPOSAL_REASON_LABELS)).toEqual(reasons);
  });

  it.each(reasons)("translates the exact predefined reason %s", (value, label) => {
    expect(disposalReasonLabel(value)).toBe(label);
  });

  describe.each(["\nNotes: ", "\nCatatan: "])("with operation delimiter %j", (delimiter) => {
    it.each(reasons)("translates %s without changing appended notes", (value, label) => {
      const notes = "Disetujui petugas\nMasa simpan berakhir\nCatatan: jangan diterjemahkan  ";
      expect(disposalReasonLabel(value + delimiter + notes)).toBe(`${label}\nNotes: ${notes}`);
    });
  });

  it.each([
    null,
    "",
    "Rusak\nCatatan: Disetujui petugas",
    "Masa simpan habis",
    "Retention period expired\nNotes: Original text",
    "Masa simpan berakhir menurut petugas",
    "Masa simpan berakhir\nCatatan khusus: simpan",
    "Masa simpan berakhir\nCatatan:tanpa spasi",
    " Masa simpan berakhir ",
    "catatan menyebut Masa simpan berakhir",
  ])("preserves arbitrary or historical text unchanged: %j", (reason) => {
    expect(disposalReasonLabel(reason)).toBe(reason);
  });
});
