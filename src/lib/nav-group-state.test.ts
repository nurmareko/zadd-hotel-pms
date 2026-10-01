import { describe, expect, it } from "vitest";
import {
  getOpenNavGroupLabels,
  isNavGroupActive,
  isNavGroupOpen,
  toggleNavGroup,
} from "./nav-group-state";

const groups = [
  { label: "Front Office", links: [{ href: "/app/fo/reservasi" }] },
  { label: "Housekeeping", links: [{ href: "/app/hk" }] },
];

describe("sidebar module disclosure", () => {
  it("opens only the active module by default", () => {
    expect(getOpenNavGroupLabels(groups, "/app/hk")).toEqual(new Set(["Housekeeping"]));
    expect(isNavGroupActive(groups[0], "/app/hk")).toBe(false);
    expect(isNavGroupActive(groups[1], "/app/hk")).toBe(true);
  });

  it("falls back to the first module on profile or unmatched routes", () => {
    expect(getOpenNavGroupLabels(groups, "/app/profile")).toEqual(new Set(["Front Office"]));
    expect(getOpenNavGroupLabels(groups, undefined)).toEqual(new Set(["Front Office"]));
    expect(getOpenNavGroupLabels([], undefined)).toEqual(new Set());
  });

  it("toggles modules independently without mutating previous state", () => {
    const initial = getOpenNavGroupLabels(groups, "/app/hk");
    const opened = toggleNavGroup(initial, "Front Office");
    expect(opened).toEqual(new Set(["Housekeeping", "Front Office"]));
    expect(toggleNavGroup(opened, "Front Office")).toEqual(initial);
    expect(initial).toEqual(new Set(["Housekeeping"]));
  });

  it("opens a newly active module while preserving other expanded modules", () => {
    const previous = new Set(["Front Office"]);
    expect(getOpenNavGroupLabels(groups, "/app/hk", previous)).toEqual(new Set(["Front Office", "Housekeeping"]));
    expect(previous).toEqual(new Set(["Front Office"]));
  });

  it("does not reopen modules for an unmatched navigation after initialization", () => {
    expect(getOpenNavGroupLabels(groups, "/app/profile", new Set())).toEqual(new Set());
  });

  it("keeps single-module roles expanded even with no selected groups", () => {
    expect(isNavGroupOpen("Housekeeping", 1, false, new Set())).toBe(true);
  });

  it("keeps every module open in rail mode and restores disclosure state afterward", () => {
    const open = new Set(["Housekeeping"]);
    for (const group of groups) {
      expect(isNavGroupOpen(group.label, groups.length, true, open)).toBe(true);
    }
    expect(isNavGroupOpen("Front Office", 2, false, open)).toBe(false);
    expect(isNavGroupOpen("Housekeeping", 2, false, open)).toBe(true);
  });
});
