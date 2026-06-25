import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import authConfig, { isHkSupervisor, type AppRole } from "@/auth.config";

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

function canUseHkSupervisorRoute(session: {
  user?: {
    role?: AppRole;
    isSupervisor?: boolean;
  };
}) {
  return isHkSupervisor(session);
}

export const proxy = auth((request) => {
  const session = request.auth;
  const { pathname } = request.nextUrl;

  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (routeMatches(pathname, "/app/hk/lost-found")) {
    if (!["HK", "FO"].includes(session.user.role)) {
      return NextResponse.rewrite(new URL("/app/forbidden", request.url));
    }

    return NextResponse.next();
  }

  if (pathname === "/app/hk") {
    if (session.user.role !== "HK") {
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
    if (!canUseHkSupervisorRoute(session)) {
      return NextResponse.rewrite(new URL("/app/forbidden", request.url));
    }

    return NextResponse.next();
  }

  if (pathname === "/app/hk/rooms") {
    if (!canUseHkSupervisorRoute(session)) {
      return NextResponse.rewrite(new URL("/app/forbidden", request.url));
    }

    return NextResponse.next();
  }

  if (routeMatches(pathname, "/app/hk/rooms")) {
    if (session.user.role !== "HK") {
      return NextResponse.rewrite(new URL("/app/forbidden", request.url));
    }

    return NextResponse.next();
  }

  if (routeMatches(pathname, "/app/hk/clean")) {
    if (session.user.role !== "HK") {
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
