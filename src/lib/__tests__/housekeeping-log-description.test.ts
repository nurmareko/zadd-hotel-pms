import { RoomStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { housekeepingLogDescription } from "../housekeeping-log-description";

describe("housekeeping history event descriptions", () => {
  it.each(Object.values(RoomStatus))("renders same-status %s events as notes, not transitions", (status) => {
    expect(housekeepingLogDescription({
      oldStatus: status,
      newStatus: status,
      note: "[TUGAS: Lainnya] Bersihkan jendela",
    })).toBe("Catatan kamar");
  });

  it.each([null, "Catatan tanpa awalan tugas"])("classifies same-status events independently of note text: %s", (note) => {
    expect(housekeepingLogDescription({ oldStatus: "VCU", newStatus: "VCU", note })).toBe("Catatan kamar");
  });

  it("does not let a task prefix disguise a real transition", () => {
    expect(housekeepingLogDescription({
      oldStatus: "VD", newStatus: "VCU", note: "[TUGAS: Lainnya] Catatan pembersihan",
    })).toBe("VD → VCU");
  });

  it.each([
    ["VCU", "VC", "VCU → VC (lulus inspeksi)"],
    ["VCU", "VD", "VCU → VD (gagal inspeksi)"],
    ["OD", "OC", "OD → OC"],
  ] as const)("preserves %s to %s transition descriptions", (oldStatus, newStatus, expected) => {
    expect(housekeepingLogDescription({ oldStatus, newStatus, note: null })).toBe(expected);
  });

  it("preserves the existing OOO transition reason", () => {
    expect(housekeepingLogDescription({ oldStatus: "VD", newStatus: "OOO", note: "Perbaikan AC" }))
      .toBe("VD → OOO (Perbaikan AC)");
  });
});
