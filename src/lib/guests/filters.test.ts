import { describe, expect, it } from "vitest";
import { buildGuestWhere, normalizeGuestQuery } from "./filters";

describe("guest query filters", () => {
  it("normalizes optional and repeated URL parameters", () => {
    expect(normalizeGuestQuery(undefined)).toBe("");
    expect(normalizeGuestQuery(null)).toBe("");
    expect(normalizeGuestQuery(42)).toBe("");
    expect(normalizeGuestQuery(["  Siti  ", "Budi"])).toBe("Siti");
  });

  it("does not filter an empty directory search", () => {
    expect(buildGuestWhere(" \t ")).toEqual({});
  });

  it("searches exactly the four requested fields case-insensitively", () => {
    expect(buildGuestWhere("  SiTi  ")).toEqual({
      OR: [
        { fullName: { contains: "SiTi", mode: "insensitive" } },
        { phone: { contains: "SiTi", mode: "insensitive" } },
        { idNumber: { contains: "SiTi", mode: "insensitive" } },
        { email: { contains: "SiTi", mode: "insensitive" } },
      ],
    });
  });

  it("treats SQL wildcard characters as literal search text", () => {
    expect(buildGuestWhere("50%_\\")).toEqual({
      OR: ["fullName", "phone", "idNumber", "email"].map((field) => ({
        [field]: { contains: "50\\%\\_\\\\", mode: "insensitive" },
      })),
    });
  });
});
