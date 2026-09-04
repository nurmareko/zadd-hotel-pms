import { describe, expect, it } from "vitest";

import {
  firstReservationErrorField,
  firstReservationErrorTab,
  normalizeReservationFieldPath,
  reservationFieldTab,
} from "./reservation-form-fields";

describe("reservation form field routing", () => {
  it.each([
    ["rooms.0.roomId", "rooms.0.roomId"],
    ["rooms.1.roomId", "rooms.1.roomId"],
    ["roomId", "rooms.0.roomId"],
    ["roomTypeId", "rooms.0.roomTypeId"],
  ])("normalizes %s to %s", (field, expected) => {
    expect(normalizeReservationFieldPath(field)).toBe(expected);
  });

  it.each([
    ["arrangementType", "inclusions"],
    ["stayFeeKinds", "inclusions"],
    ["fullName", "detail"],
    ["rooms.1.roomId", "detail"],
  ] as const)("maps %s to the %s tab", (field, expected) => {
    expect(reservationFieldTab(field)).toBe(expected);
  });

  it.each(["rooms.1.unknown", "rooms.one.roomId", "prototype", ""])(
    "rejects an unknown or disallowed path: %s",
    (field) => {
      expect(normalizeReservationFieldPath(field)).toBeNull();
      expect(reservationFieldTab(field)).toBeNull();
    },
  );

  it("uses deterministic form order when Detail and Inklusi both contain errors", () => {
    const errors = {
      arrangementType: { type: "custom", message: "Pilih meal plan" },
      rooms: [
        undefined,
        { roomId: { type: "custom", message: "Pilih kamar" } },
      ],
      fullName: { type: "custom", message: "Nama tamu wajib diisi" },
    };

    expect(firstReservationErrorField(errors)).toBe("fullName");
    expect(firstReservationErrorTab(errors)).toBe("detail");
  });

  it("selects Inklusi when the first relevant error belongs to Inklusi", () => {
    const errors = {
      stayFeeKinds: {
        type: "custom",
        message: "Pilihan fleksibilitas tidak tersedia",
      },
    };

    expect(firstReservationErrorField(errors)).toBe("stayFeeKinds");
    expect(firstReservationErrorTab(errors)).toBe("inclusions");
  });
});
