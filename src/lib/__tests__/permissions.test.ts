import { describe, expect, it } from "vitest";

import { isAppRole, type AppRole } from "@/auth.config";
import {
  can,
  canAccessModule,
  getAllowedModules,
  type AppModule,
  type Capability,
} from "@/lib/permissions";

const modules: AppModule[] = [
  "front_office", "housekeeping", "food_and_beverage", "accounting", "revenue", "operations", "admin",
];

// Independent expectations: adding a capability requires an explicit policy decision.
const capabilityRoles = {
  "reservations:read": ["ADMIN", "GM", "FO"],
  "reservations:write": ["ADMIN", "GM", "FO"],
  "checkin:manage": ["ADMIN", "GM", "FO"],
  "checkout:manage": ["ADMIN", "GM", "FO"],
  "room_blocks:manage": ["ADMIN", "GM", "FO"],
  "folio:charge": ["ADMIN", "GM", "FO"],
  "folio:settle": ["ADMIN", "GM", "FO"],
  "rooms:read": ["ADMIN", "GM", "FO", "HK"],
  "rooms:clean": ["ADMIN", "GM", "HK"],
  "rooms:override_status": ["ADMIN", "GM", "HK"],
  "laundry:manage": ["ADMIN", "GM", "HK"],
  "lost_found:manage": ["ADMIN", "GM", "FO", "HK"],
  "orders:read": ["ADMIN", "GM", "FB"],
  "orders:write": ["ADMIN", "GM", "FB"],
  "orders:bill": ["ADMIN", "GM", "FB"],
  "pos:settle": ["ADMIN", "GM", "FB"],
  "night_audit:run": ["ADMIN", "GM", "ACC"],
  "accounting:export": ["ADMIN", "GM", "ACC"],
  "folios:audit": ["ADMIN", "GM", "ACC"],
  "revenue:read": ["ADMIN", "GM"],
  "operations:read": ["ADMIN", "GM", "FO"],
  "operations:manage": ["ADMIN", "GM", "FO"],
  "food_and_beverage:manage_menu": ["ADMIN", "GM", "FB"],
  "pricing_rules:manage": ["ADMIN", "GM"],
  "users:manage": ["ADMIN"],
  "system_settings:manage": ["ADMIN"],
} satisfies Record<Capability, AppRole[]>;

const roleModules = {
  ADMIN: modules,
  GM: ["front_office", "housekeeping", "food_and_beverage", "accounting", "revenue", "operations"],
  FO: ["front_office", "housekeeping", "operations"],
  HK: ["housekeeping"],
  FB: ["food_and_beverage"],
  ACC: ["accounting"],
} satisfies Record<AppRole, AppModule[]>;

const roles = Object.keys(roleModules) as AppRole[];
const capabilities = Object.keys(capabilityRoles) as Capability[];
const invalidRoles: unknown[] = [
  undefined, null, "", "UNKNOWN", "gm", " GM", "ADMIN ",
  "__proto__", "constructor", "toString", 0, true, {}, ["ADMIN"],
  { toString: () => "ADMIN" },
];

describe("permission matrix", () => {
  describe.each(roles)("%s", (role) => {
    it("recognizes the role", () => {
      expect(isAppRole(role)).toBe(true);
    });

    it("returns exactly its allowed modules", () => {
      expect(getAllowedModules(role)).toEqual(roleModules[role]);
    });

    it.each(modules)("enforces access to %s", (module) => {
      expect(canAccessModule(role, module)).toBe(
        (roleModules[role] as AppModule[]).includes(module),
      );
    });

    it.each(capabilities)("enforces %s", (capability) => {
      expect(can(role, capability)).toBe(
        (capabilityRoles[capability] as AppRole[]).includes(role),
      );
    });

    it("returns a copy that cannot change subsequent authorization", () => {
      const allowed = getAllowedModules(role);
      allowed.splice(0, allowed.length, "admin");
      expect(getAllowedModules(role)).toEqual(roleModules[role]);
      expect(canAccessModule(role, "admin")).toBe(role === "ADMIN");
    });

    it("denies invalid modules and capabilities even for ADMIN", () => {
      for (const invalid of [undefined, null, "unknown", "__proto__", "constructor", {}]) {
        expect(canAccessModule(role, invalid as AppModule)).toBe(false);
        expect(can(role, invalid as Capability)).toBe(false);
      }
    });
  });

  it.each(invalidRoles.map((role) => [role]))("fails closed for invalid role %j", (role) => {
    expect(isAppRole(role)).toBe(false);
    // Exercise malformed runtime input while preserving the public typed API.
    const invalid = role as AppRole;
    expect(getAllowedModules(invalid)).toEqual([]);
    for (const appModule of modules) {
      expect(canAccessModule(invalid, appModule)).toBe(false);
    }
    for (const capability of capabilities) {
      expect(can(invalid, capability)).toBe(false);
    }
  });
});
