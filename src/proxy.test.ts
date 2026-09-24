import { describe, expect, it, vi } from "vitest";

import type { AppRole } from "@/auth.config";
import { resolveAppRouteAccess } from "@/proxy";

// The pure resolver does not need NextAuth's request/session runtime.
vi.mock("next-auth", () => ({
  default: () => ({ auth: (handler: unknown) => handler }),
}));

const roles: AppRole[] = ["ADMIN", "GM", "FO", "HK", "FB", "ACC"];
const modulePaths = ["/app/fo", "/app/hk", "/app/fb", "/app/acc", "/app/admin", "/app/revenue"];

// Expected access is explicit so changes to the permission matrix cannot silently
// change both the implementation and its test expectations.
const allowedPaths: Record<AppRole, string[]> = {
  ADMIN: modulePaths,
  GM: ["/app/fo", "/app/hk", "/app/fb", "/app/acc", "/app/revenue"],
  FO: ["/app/fo", "/app/hk"],
  HK: ["/app/hk"],
  FB: ["/app/fb"],
  ACC: ["/app/acc", "/app/revenue"],
};

describe("resolveAppRouteAccess", () => {
  it.each([
    ...modulePaths,
    "/app",
    "/app/",
    "/app/forbidden",
    "/app/hk/list",
    "/app/hk/supervisor",
    "/app/hk/rooms/export",
    "/app/unknown",
    "/app/revenue/seasons",
  ])("redirects unauthenticated requests to login: %s", (pathname) => {
    expect(resolveAppRouteAccess(pathname)).toEqual({ type: "login_redirect" });
  });

  describe.each(roles)("%s role", (role) => {
    it.each(modulePaths)("enforces module access for %s", (pathname) => {
      expect(resolveAppRouteAccess(pathname, role)).toEqual({
        type: allowedPaths[role].includes(pathname) ? "next" : "forbidden_rewrite",
      });
    });

    it("enforces access to revenue seasons", () => {
      expect(resolveAppRouteAccess("/app/revenue/seasons", role)).toEqual({
        type: ["ADMIN", "GM", "ACC"].includes(role) ? "next" : "forbidden_rewrite",
      });
    });

    it.each(["/app", "/app/", "/app/forbidden"])("passes through %s", (pathname) => {
      expect(resolveAppRouteAccess(pathname, role)).toEqual({ type: "next" });
    });

    it.each([
      ["/app/hk/list", 307],
      ["/app/hk/list/legacy", 307],
      ["/app/hk/supervisor", 308],
      ["/app/hk/supervisor/legacy", 308],
    ] as const)("preserves the compatibility redirect for %s", (pathname, status) => {
      expect(resolveAppRouteAccess(pathname, role)).toEqual({
        type: "redirect",
        destination: "/app/hk/rooms",
        status,
      });
    });

    it("checks housekeeping access for exports", () => {
      expect(resolveAppRouteAccess("/app/hk/rooms/export", role)).toEqual(
        ["ADMIN", "GM", "FO", "HK"].includes(role)
          ? { type: "next" }
          : {
              type: "forbidden_response",
              message: "Anda tidak memiliki akses untuk mengekspor papan kamar.",
            },
      );
    });
  });

  it.each([
    "/app/fo/reservasi",
    "/app/fo/tape-chart",
    "/app/fo/staff-performance",
    "/app/hk/rooms",
    "/app/hk/laundry",
    "/app/acc/night-audit",
    "/app/acc/folios",
  ])("allows GM on nested operational routes: %s", (pathname) => {
    expect(resolveAppRouteAccess(pathname, "GM")).toEqual({ type: "next" });
  });

  it.each(["/app/admin/users", "/app/admin/settings"])("blocks GM on %s", (pathname) => {
    expect(resolveAppRouteAccess(pathname, "GM")).toEqual({ type: "forbidden_rewrite" });
  });

  it("allows FO on housekeeping lost-found", () => {
    expect(resolveAppRouteAccess("/app/hk/lost-found", "FO")).toEqual({ type: "next" });
  });

  it.each(["/app/foobar", "/app/admin-tools", "/app/revenue-tools", "/app/unknown"])(
    "does not treat a partial segment or unknown route as a module: %s",
    (pathname) => {
      expect(resolveAppRouteAccess(pathname, "HK")).toEqual({ type: "next" });
    },
  );

  it.each(["/app/hk/listing", "/app/hk/supervisors"])(
    "does not redirect a partial compatibility segment: %s",
    (pathname) => {
      expect(resolveAppRouteAccess(pathname, "FB")).toEqual({ type: "forbidden_rewrite" });
    },
  );
});
