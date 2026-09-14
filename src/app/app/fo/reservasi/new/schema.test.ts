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
