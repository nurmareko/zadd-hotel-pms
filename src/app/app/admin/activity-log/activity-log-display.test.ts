import { describe, expect, it } from "vitest";
import { activityHref, activityLabels, activitySummary, activityTime, parseActivityQuery } from "./activity-log-display";
import { ActivityAction } from "@prisma/client";
import { actionLabel } from "../../fo/staff-performance/activity";

describe("activity log display", () => {
  it("labels every actual action", () => {
    expect(Object.keys(activityLabels)).toEqual(Object.values(ActivityAction));
    expect(Object.values(activityLabels)).toEqual([
      "Reservation Created", "Reservation Updated", "Reservation Cancelled",
      "Check-in Completed", "Check-out Completed", "Payment Recorded", "Charge Posted",
      "Room Cleaned", "Room Inspected", "F&B Order Created", "F&B Order Settled",
      "Night Audit Executed",
    ]);
  });

  it("provides safe FO labels for new actions and unknown values", () => {
    for (const [action, label] of [
      ["ROOM_CLEANED", "Room cleaned"], ["ROOM_INSPECTED", "Room inspected"],
      ["FB_ORDER_CREATED", "F&B order created"], ["FB_ORDER_SETTLED", "F&B order settled"],
      ["NIGHT_AUDIT_EXECUTED", "Night audit executed"],
    ]) {
      expect(actionLabel(action as ActivityAction)).toBe(label);
    }
    expect(actionLabel("UNKNOWN" as ActivityAction)).toBe("Unknown activity");
  });

  it("parses valid filters and preserves them in pagination", () => {
    const filters = parseActivityQuery({ action: "PAYMENT_RECORDED", userId: "12", page: "3" });
    expect(filters).toEqual({ action: "PAYMENT_RECORDED", userId: 12, page: 3 });
    expect(activityHref(filters, 2)).toBe("/app/admin/activity-log?action=PAYMENT_RECORDED&userId=12&page=2");
    expect(activityHref(filters)).not.toContain("page=");
  });

  it.each(["0", "-1", "1.5", "1e3", "Infinity", "9007199254740992", "abc", ["1", "2"]])("rejects malformed page and user ID %j", (value) => {
    expect(parseActivityQuery({ page: value, userId: value })).toEqual({ action: undefined, userId: undefined, page: 1 });
  });

  it("validates enum and PostgreSQL integer bounds", () => {
    expect(parseActivityQuery({ action: "toString", userId: "2147483648" })).toEqual({ action: undefined, userId: undefined, page: 1 });
    expect(parseActivityQuery({ action: ["PAYMENT_RECORDED"] }).action).toBeUndefined();
    expect(parseActivityQuery({ userId: "2147483647", page: "9007199254740991" })).toMatchObject({ userId: 2147483647, page: Number.MAX_SAFE_INTEGER });
  });

  it("shows only allowlisted metadata", () => {
    expect(activitySummary({ amount: 125000, method: "CASH", password: "SECRET", token: "SECRET", nested: { amount: 100 } })).toBe("Rp 125.000 · Method: Cash");
    expect(activitySummary({ note: " Catatan tamu ", article: "MINIBAR", seed: "hidden" })).toBe("Article: MINIBAR · Notes: Catatan tamu");
    expect(activitySummary({ method: "toString", amount: "SECRET", note: { secret: true } })).toBe("—");
    expect(activitySummary(null)).toBe("—");
    expect(activitySummary(["SECRET"])).toBe("—");
    expect(activitySummary({ note: "a".repeat(500) })).toBe(`Notes: ${"a".repeat(300)}…`);
  });

  it.each(["ROOM_CLEANED", "ROOM_INSPECTED"] as const)("summarizes %s", (action) => {
    expect(activitySummary({ roomNumber: " 101 ", targetStatus: "VC", password: "SECRET" }, action)).toBe("Room 101 · Status: VC");
    expect(activitySummary({ roomNumber: {}, targetStatus: ["VC"], note: "SECRET" }, action)).toBe("—");
  });

  it.each([["DINE_IN", "Dine-in"], ["ROOM_SERVICE", "Room Service"]])("labels %s service", (orderType, label) => {
    expect(activitySummary({ orderNo: "FB-001", orderType }, "FB_ORDER_CREATED")).toBe(`Order #FB-001 (${label})`);
  });

  it.each([["CASH", "Cash"], ["CARD", "Card"], ["TRANSFER", "Transfer"], ["CHARGE_TO_ROOM", "Charge to Room"]])("labels %s settlement", (paymentMethod, label) => {
    expect(activitySummary({ orderNo: "FB-001", amount: "125000.00", paymentMethod, token: "SECRET" }, "FB_ORDER_SETTLED")).toBe(`Order #FB-001 · Total: Rp 125.000 via ${label}`);
  });

  it.each(["", " ", "NaN", "Infinity", "1e3", "0x10", "1,000", "1.2.3", "9".repeat(400), {}, [], null])("omits malformed settlement amount %j", (amount) => {
    expect(activitySummary({ orderNo: "FB-001", amount, paymentMethod: "toString" }, "FB_ORDER_SETTLED")).toBe("Order #FB-001");
  });

  it("handles partial, unknown, and oversized metadata safely", () => {
    expect(activitySummary({ orderNo: "FB-001", orderType: "toString" }, "FB_ORDER_CREATED")).toBe("Order #FB-001");
    expect(activitySummary({ orderNo: {}, orderType: {} }, "FB_ORDER_CREATED")).toBe("—");
    expect(activitySummary({ amount: "0.00", paymentMethod: "CASH" }, "FB_ORDER_SETTLED")).toBe("Total: Rp 0 via Cash");
    expect(activitySummary({ roomNumber: "a".repeat(500), targetStatus: "SECRET" }, "ROOM_CLEANED")).toBe(`Room ${"a".repeat(300)}…`);
    expect(activitySummary(null, "ROOM_CLEANED")).toBe("—");
    expect(activitySummary([], "FB_ORDER_SETTLED")).toBe("—");
  });

  it("shows the operating date without timezone conversion", () => {
    expect(activitySummary({ businessDate: "2026-06-01", note: "SECRET" }, "NIGHT_AUDIT_EXECUTED")).toBe("Operating Date: 2026-06-01");
  });

  it.each(["2026-02-30", "2026-13-01", "2026-6-1", "2026-06-01T00:00:00Z", "SECRET", {}, null])("omits malformed business date %j", (businessDate) => {
    expect(activitySummary({ businessDate }, "NIGHT_AUDIT_EXECUTED")).toBe("—");
  });

  it("formats WIB across midnight and a server DST gap", () => {
    expect(activityTime(new Date("2026-05-31T17:40:00Z"))).toBe("1 Jun 2026 00:40 WIB");
    expect(activityTime(new Date("2026-03-07T19:30:00Z"))).toBe("8 Mar 2026 02:30 WIB");
  });
});
