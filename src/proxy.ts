import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import authConfig, { type AppRole } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const roleRoutes: Array<{ prefix: string; roles: AppRole[] }> = [
  { prefix: "/app/fo", roles: ["FO"] },
  { prefix: "/app/fb", roles: ["FB"] },
  { prefix: "/app/acc", roles: ["ACC"] },
  { prefix: "/app/admin", roles: ["ADMIN"] },
];

function routeMatches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}


export const proxy = auth((request) => {
  const session = request.auth;
  const { pathname } = request.nextUrl;

  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (routeMatches(pathname, "/app/fo/staff-performance")) {
    if (!["FO", "ADMIN"].includes(session.user.role)) {
      return NextResponse.rewrite(new URL("/app/forbidden", request.url));
    }

    return NextResponse.next();
  }

  if (routeMatches(pathname, "/app/acc/folios")) {
    if (!["ACC", "ADMIN"].includes(session.user.role)) {
      return NextResponse.rewrite(new URL("/app/forbidden", request.url));
    }

    return NextResponse.next();
  }

  if (
    routeMatches(pathname, "/app/fo/reservasi") ||
    routeMatches(pathname, "/app/fo/reservations") ||
    routeMatches(pathname, "/app/fo/tape-chart") ||
    routeMatches(pathname, "/app/fo/tamu") ||
    routeMatches(pathname, "/app/fo/room-blocks")
  ) {
    if (!["FO", "ADMIN"].includes(session.user.role)) {
      return NextResponse.rewrite(new URL("/app/forbidden", request.url));
    }

    return NextResponse.next();
  }

  if (routeMatches(pathname, "/app/hk/lost-found")) {
    if (!["HK", "FO"].includes(session.user.role)) {
      return NextResponse.rewrite(new URL("/app/forbidden", request.url));
    }

    return NextResponse.next();
  }

  if (pathname === "/app/hk") {
    if (!["HK", "ADMIN"].includes(session.user.role)) {
      return NextResponse.rewrite(new URL("/app/forbidden", request.url));
    }

    return NextResponse.next();
  }

  if (routeMatches(pathname, "/app/hk/list")) {
    const url = request.nextUrl.clone();
    url.pathname = "/app/hk/rooms";
    return NextResponse.redirect(url);
  }

  if (routeMatches(pathname, "/app/hk/supervisor")) {
    const url = request.nextUrl.clone();
    url.pathname = "/app/hk/rooms";
    return NextResponse.redirect(url, { status: 308 });
  }

  if (
    routeMatches(pathname, "/app/hk/rooms") ||
    routeMatches(pathname, "/app/hk/mobile") ||
    routeMatches(pathname, "/app/hk/clean") ||
    routeMatches(pathname, "/app/hk/laundry")
  ) {
    if (!["HK", "ADMIN"].includes(session.user.role)) {
      return NextResponse.rewrite(new URL("/app/forbidden", request.url));
    }

    return NextResponse.next();
  }

  if (routeMatches(pathname, "/app/hk")) {
    if (session.user.role !== "HK") {
      return NextResponse.rewrite(new URL("/app/forbidden", request.url));
    }

    return NextResponse.next();
  }

  const requiredRoles = roleRoutes.find(({ prefix }) =>
    routeMatches(pathname, prefix),
  )?.roles;

  if (requiredRoles && !requiredRoles.includes(session.user.role)) {
    return NextResponse.rewrite(new URL("/app/forbidden", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/app/:path*"],
};
