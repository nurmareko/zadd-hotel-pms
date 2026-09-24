import { isAppRole, type AppRole } from "@/auth.config";

export type AppModule =
  | "front_office"
  | "housekeeping"
  | "food_and_beverage"
  | "accounting"
  | "revenue"
  | "admin";

const moduleAccess: Record<AppRole, readonly AppModule[]> = {
  ADMIN: ["front_office", "housekeeping", "food_and_beverage", "accounting", "revenue", "admin"],
  GM: ["front_office", "housekeeping", "food_and_beverage", "accounting", "revenue"],
  FO: ["front_office", "housekeeping"],
  HK: ["housekeeping"],
  FB: ["food_and_beverage"],
  ACC: ["accounting", "revenue"],
};

const capabilityAccess = {
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
  "revenue:read": ["ADMIN", "GM", "ACC"],
  // Commercial pricing belongs to management, not accounting or system configuration.
  "pricing_rules:manage": ["ADMIN", "GM"],
  "users:manage": ["ADMIN"],
  "system_settings:manage": ["ADMIN"],
} satisfies Record<string, readonly AppRole[]>;

export type Capability = keyof typeof capabilityAccess;

export function canAccessModule(role: AppRole, module: AppModule): boolean {
  return isAppRole(role) && moduleAccess[role].includes(module);
}

export function can(role: AppRole, capability: Capability): boolean {
  if (
    !isAppRole(role) ||
    typeof capability !== "string" ||
    !Object.hasOwn(capabilityAccess, capability)
  ) {
    return false;
  }

  return (capabilityAccess[capability] as readonly AppRole[]).includes(role);
}

export function getAllowedModules(role: AppRole): AppModule[] {
  // A caller may sort or modify the result without changing authorization policy.
  return isAppRole(role) ? [...moduleAccess[role]] : [];
}
