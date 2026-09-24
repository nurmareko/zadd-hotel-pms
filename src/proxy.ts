import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import authConfig, { type AppRole } from "@/auth.config";
import { canAccessModule, type AppModule } from "@/lib/permissions";

const { auth } = NextAuth(authConfig);

const modulePrefixes: Array<{ prefix: string; module: AppModule }> = [
  { prefix: "/app/fo", module: "front_office" },
  { prefix: "/app/hk", module: "housekeeping" },
  { prefix: "/app/fb", module: "food_and_beverage" },
  { prefix: "/app/acc", module: "accounting" },
  { prefix: "/app/revenue", module: "revenue" },
  { prefix: "/app/ops", module: "operations" },
  { prefix: "/app/admin", module: "admin" },
];

function routeMatches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export type RouteAccessDecision =
  | { type: "next" }
  | { type: "login_redirect" }
  | { type: "redirect"; destination: string; status?: number }
  | { type: "forbidden_rewrite" }
  | { type: "forbidden_response"; message: string };

export function resolveAppRouteAccess(
  pathname: string,
  userRole?: AppRole,
): RouteAccessDecision {
  if (!userRole) {
    return { type: "login_redirect" };
  }

  if (pathname === "/app" || pathname === "/app/" || pathname === "/app/forbidden") {
    return { type: "next" };
  }

  if (routeMatches(pathname, "/app/admin/menu")) {
    return { type: "redirect", destination: "/app/fb/menu", status: 307 };
  }
  if (routeMatches(pathname, "/app/hk/list")) {
    return { type: "redirect", destination: "/app/hk/rooms", status: 307 };
  }
  if (routeMatches(pathname, "/app/hk/supervisor")) {
    return { type: "redirect", destination: "/app/hk/rooms", status: 308 };
  }

  // Authenticated downloads return HTTP errors instead of an HTML page.
  if (pathname === "/app/hk/rooms/export") {
    if (!canAccessModule(userRole, "housekeeping")) {
      return {
        type: "forbidden_response",
        message: "Anda tidak memiliki akses untuk mengekspor papan kamar.",
      };
    }
    return { type: "next" };
  }

  const matched = modulePrefixes.find(({ prefix }) => routeMatches(pathname, prefix));
  if (matched && !canAccessModule(userRole, matched.module)) {
    return { type: "forbidden_rewrite" };
  }

  return { type: "next" };
}

export const proxy = auth((request) => {
  const decision = resolveAppRouteAccess(request.nextUrl.pathname, request.auth?.user?.role);

  switch (decision.type) {
    case "login_redirect":
      return NextResponse.redirect(new URL("/login", request.url));
    case "redirect":
      return NextResponse.redirect(new URL(decision.destination, request.url), {
        status: decision.status,
      });
    case "forbidden_rewrite":
      return NextResponse.rewrite(new URL("/app/forbidden", request.url));
    case "forbidden_response":
      return new NextResponse(decision.message, { status: 403 });
    case "next":
      return NextResponse.next();
  }
});

export const config = {
  matcher: ["/app/:path*"],
};
