import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import authConfig, { type AppRole } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const roleRoutes: Array<{ prefix: string; role: AppRole }> = [
  { prefix: "/app/fo", role: "FO" },
  { prefix: "/app/hk", role: "HK" },
  { prefix: "/app/fb", role: "FB" },
  { prefix: "/app/acc", role: "ACC" },
  { prefix: "/app/admin", role: "ADMIN" },
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

  const requiredRole = roleRoutes.find(({ prefix }) =>
    routeMatches(pathname, prefix),
  )?.role;

  if (requiredRole && session.user.role !== requiredRole) {
    return NextResponse.rewrite(new URL("/app/forbidden", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/app/:path*"],
};
