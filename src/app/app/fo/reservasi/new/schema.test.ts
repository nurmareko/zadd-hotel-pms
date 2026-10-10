import { describe, expect, it } from "vitest";

import { UnifiedReservationSchema } from "./schema";

const validInput = {
  fullName: "Tamu Uji",
  idType: "KTP",
  arrivalDate: "2026-10-01",
  departureDate: "2026-10-02",
  reservationType: "INDIVIDUAL",
  arrangementType: "RO",
  stayFeeKinds: [],
  rooms: [{ roomTypeId: 1, roomId: null, adults: 1, children: 0 }],
};

describe("reservation stay fee schema", () => {
  it.each([1, 2])("defaults omitted fees to [] for %i rooms", (roomCount) => {
    const input = { ...validInput, rooms: Array.from({ length: roomCount }, () => validInput.rooms[0]) };
    Reflect.deleteProperty(input, "stayFeeKinds");
    expect(UnifiedReservationSchema.parse(input).stayFeeKinds).toEqual([]);
  });

  it.each([1, 2])("accepts empty fees for %i rooms", (roomCount) => {
    expect(UnifiedReservationSchema.parse({
      ...validInput,
      rooms: Array.from({ length: roomCount }, () => validInput.rooms[0]),
    }).stayFeeKinds).toEqual([]);
  });

  it.each([1, 2])("accepts explicit fees for %i rooms", (roomCount) => {
    const stayFeeKinds = ["EARLY_CHECK_IN", "LATE_CHECK_OUT"];
    expect(UnifiedReservationSchema.parse({
      ...validInput,
      rooms: Array.from({ length: roomCount }, () => validInput.rooms[0]),
      stayFeeKinds,
    }).stayFeeKinds).toEqual(stayFeeKinds);
  });

  it.each([
    null,
    ["INVALID"],
    ["EARLY_CHECK_IN", "EARLY_CHECK_IN"],
    ["EARLY_CHECK_IN", "LATE_CHECK_OUT", "EARLY_CHECK_IN"],
  ])("rejects invalid fees %j", (stayFeeKinds) => {
    const result = UnifiedReservationSchema.safeParse({ ...validInput, stayFeeKinds });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path[0]).toBe("stayFeeKinds");
  });
});

describe("per-room occupant schema", () => {
  it.each([undefined, "", "   ", "  Sari Putri  ", "A".repeat(100)])("accepts and trims occupant %j", (occupantName) => {
    const parsed = UnifiedReservationSchema.parse({
      ...validInput,
      rooms: [{ ...validInput.rooms[0], occupantName }],
    });
    expect(parsed.rooms[0].occupantName).toBe(occupantName?.trim());
  });

  it.each(["A".repeat(101), null, 123])("rejects invalid occupant %j", (occupantName) => {
    const result = UnifiedReservationSchema.safeParse({
      ...validInput,
      rooms: [{ ...validInput.rooms[0], occupantName }],
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(["rooms", 0, "occupantName"]);
  });
});

describe("per-room custom rate schema", () => {
  it.each([undefined, "", "   "])("omits blank rate %j instead of coercing to zero", (customRate) => {
    const parsed = UnifiedReservationSchema.parse({ ...validInput, rooms: [{ ...validInput.rooms[0], customRate }] });
    expect(parsed.rooms[0].customRate).toBeUndefined();
  });

  it.each(["0", "100000000", " 450000 "])("accepts integer rate %j", (customRate) => {
    const parsed = UnifiedReservationSchema.parse({ ...validInput, rooms: [{ ...validInput.rooms[0], customRate, customRateReason: "  Kesepakatan tamu  " }] });
    expect(parsed.rooms[0].customRate).toBe(Number(customRate));
    expect(parsed.rooms[0].customRateReason).toBe("Kesepakatan tamu");
  });

  it.each(["-1", "1.5", "100000001", "NaN", "Infinity", null, true, [], {}])("rejects invalid rate %j", (customRate) => {
    const parsed = UnifiedReservationSchema.safeParse({ ...validInput, rooms: [{ ...validInput.rooms[0], customRate }] });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0].path).toEqual(["rooms", 0, "customRate"]);
  });

  it.each([undefined, "", "   ", "a".repeat(255)])("accepts optional trimmed reason %j", (customRateReason) => {
    const parsed = UnifiedReservationSchema.parse({ ...validInput, rooms: [{ ...validInput.rooms[0], customRateReason }] });
    expect(parsed.rooms[0].customRateReason).toBe(customRateReason?.trim() || undefined);
  });

  it("rejects reasons longer than 255 characters", () => {
    const parsed = UnifiedReservationSchema.safeParse({ ...validInput, rooms: [{ ...validInput.rooms[0], customRateReason: "a".repeat(256) }] });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0].path).toEqual(["rooms", 0, "customRateReason"]);
  });
});

describe("reservation guest link schema", () => {
  it.each([undefined, null, 42, "42"])("accepts optional guestId %s", (guestId) => {
    const parsed = UnifiedReservationSchema.parse({ ...validInput, guestId });
    expect(parsed.guestId).toBe(guestId == null ? guestId : 42);
  });

  it.each([0, -1, 1.5, "invalid", "", Infinity])("rejects invalid guestId %s", (guestId) => {
    const result = UnifiedReservationSchema.safeParse({ ...validInput, guestId });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(["guestId"]);
  });

  it("still requires guest fields when linking an existing guest", () => {
    expect(UnifiedReservationSchema.safeParse({ ...validInput, guestId: 42, fullName: "" }).success).toBe(false);
    expect(UnifiedReservationSchema.safeParse({ ...validInput, guestId: 42, idType: "" }).success).toBe(false);
  });
});
