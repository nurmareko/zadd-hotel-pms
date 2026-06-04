import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import authConfig, { isHkSupervisor, type AppRole } from "@/auth.config";

const { auth } = NextAuth(authConfig);
const hkSupervisorPrefix = "/app/hk/supervisor";

const roleRoutes: Array<{ prefix: string; roles: AppRole[] }> = [
  { prefix: hkSupervisorPrefix, roles: ["HK", "ADMIN"] },
  { prefix: "/app/hk/list", roles: ["HK", "ADMIN"] },
  { prefix: "/app/fo", roles: ["FO"] },
  { prefix: "/app/hk", roles: ["HK"] },
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

  if (
    routeMatches(pathname, hkSupervisorPrefix) &&
    session.user.role !== "ADMIN" &&
    !isHkSupervisor(session)
  ) {
    return NextResponse.rewrite(new URL("/app/forbidden", request.url));
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
