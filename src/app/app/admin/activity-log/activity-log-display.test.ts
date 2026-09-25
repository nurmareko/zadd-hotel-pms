import { describe, expect, it } from "vitest";
import { activityHref, activityLabels, activitySummary, activityTime, parseActivityQuery } from "./activity-log-display";
import { ActivityAction } from "@prisma/client";

describe("activity log display", () => {
  it("labels every actual action", () => {
    expect(Object.keys(activityLabels)).toEqual(Object.values(ActivityAction));
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
    expect(activitySummary({ amount: 125000, method: "CASH", password: "SECRET", token: "SECRET", nested: { amount: 100 } })).toBe("Rp 125.000 · Metode: Tunai");
    expect(activitySummary({ note: " Catatan tamu ", article: "MINIBAR", seed: "hidden" })).toBe("Artikel: MINIBAR · Catatan: Catatan tamu");
    expect(activitySummary({ method: "toString", amount: "SECRET", note: { secret: true } })).toBe("—");
    expect(activitySummary(null)).toBe("—");
    expect(activitySummary(["SECRET"])).toBe("—");
    expect(activitySummary({ note: "a".repeat(500) })).toHaveLength(310);
  });

  it("formats WIB across midnight and a server DST gap", () => {
    expect(activityTime(new Date("2026-05-31T17:40:00Z"))).toBe("1 Jun 2026 00:40 WIB");
    expect(activityTime(new Date("2026-03-07T19:30:00Z"))).toBe("8 Mar 2026 02:30 WIB");
  });
});
