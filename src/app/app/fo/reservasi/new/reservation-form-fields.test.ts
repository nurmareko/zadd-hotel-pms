import { describe, expect, it } from "vitest";

import {
  firstReservationErrorField,
  normalizeReservationFieldPath,
} from "./reservation-form-fields";

describe("reservation form field focusing", () => {
  it.each([
    ["rooms.0.roomId", "rooms.0.roomId"],
    ["rooms.1.roomId", "rooms.1.roomId"],
    ["roomId", "rooms.0.roomId"],
    ["roomTypeId", "rooms.0.roomTypeId"],
    ["adults", "rooms.0.adults"],
    ["children", "rooms.0.children"],
    ["arrangementType", "arrangementType"],
  ])("normalizes %s to %s", (field, expected) => {
    expect(normalizeReservationFieldPath(field)).toBe(expected);
  });

  it.each(["rooms.1.unknown", "rooms.one.roomId", "prototype", "", "stayFeeKinds"])(
    "rejects an unknown or removed field: %s",
    (field) => {
      expect(normalizeReservationFieldPath(field)).toBeNull();
    },
  );

  it("prioritizes stay details over guest, room, and meal errors", () => {
    expect(firstReservationErrorField({
      arrangementType: { type: "custom" },
      rooms: [{ roomId: { type: "custom" } }],
      fullName: { type: "custom" },
      arrivalDate: { type: "custom" },
    })).toBe("arrivalDate");
  });

  it("prioritizes guest details over room and meal errors", () => {
    expect(firstReservationErrorField({
      arrangementType: { type: "custom" },
      rooms: [undefined, { roomId: { type: "custom" } }],
      fullName: { type: "custom" },
    })).toBe("fullName");
  });

  it("selects the first invalid room before meal inclusion", () => {
    expect(firstReservationErrorField({
      arrangementType: { type: "custom" },
      rooms: [undefined, { adults: { type: "custom" }, roomId: { type: "custom" } }],
    })).toBe("rooms.1.roomId");
  });

  it("preserves room-array errors", () => {
    expect(firstReservationErrorField({ rooms: { type: "custom" } })).toBe("rooms");
  });

  it("selects arrangement type when only meal inclusion is invalid", () => {
    expect(firstReservationErrorField({
      arrangementType: { type: "custom", message: "Pilih paket makan" },
    })).toBe("arrangementType");
  });

  it.each([null, {}, { unknown: { type: "custom" } }, { stayFeeKinds: { type: "custom" } }])(
    "returns no focus target for errors outside the visible form: %j",
    (errors) => {
      expect(firstReservationErrorField(errors)).toBeNull();
    },
  );
});
