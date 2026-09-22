import { format } from "date-fns";
import { describe, expect, it } from "vitest";

import { formatISODate } from "@/lib/format";

import {
  buildCalendarDays,
  formatCalendarMonthTitle,
  isDateInVisibleWindow,
  WEEKDAY_LABELS,
} from "./date-range-picker";

describe("date range picker calendar", () => {
  it("builds a Monday-first grid spanning the full displayed month", () => {
    const days = buildCalendarDays(new Date(2026, 8, 15));

    expect(days).toHaveLength(35);
    expect(formatISODate(days[0])).toBe("2026-08-31");
    expect(formatISODate(days.at(-1)!)).toBe("2026-10-04");
    expect(format(days[0], "i")).toBe("1");
    expect(format(days.at(-1)!, "i")).toBe("7");
  });

  it("uses Indonesian month and weekday labels", () => {
    expect(formatCalendarMonthTitle(new Date(2026, 8, 1))).toBe(
      "September 2026",
    );
    expect(WEEKDAY_LABELS).toEqual([
      "Sen",
      "Sel",
      "Rab",
      "Kam",
      "Jum",
      "Sab",
      "Min",
    ]);
  });

  it("treats the visible 14-day window as a half-open date range", () => {
    const visibleStartDate = new Date(2026, 8, 10);

    expect(
      isDateInVisibleWindow(new Date(2026, 8, 10), visibleStartDate),
    ).toBe(true);
    expect(
      isDateInVisibleWindow(new Date(2026, 8, 23), visibleStartDate),
    ).toBe(true);
    expect(
      isDateInVisibleWindow(new Date(2026, 8, 24), visibleStartDate),
    ).toBe(false);
    expect(
      isDateInVisibleWindow(new Date(2026, 8, 9), visibleStartDate),
    ).toBe(false);
  });
});
