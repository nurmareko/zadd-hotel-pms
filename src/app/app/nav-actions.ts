"use server";

import { cookies } from "next/headers";

import { NAV_SIDEBAR_COLLAPSED_COOKIE } from "@/lib/nav-preferences";

export async function setNavSidebarCollapsed(collapsed: boolean) {
  const cookieStore = await cookies();

  cookieStore.set(NAV_SIDEBAR_COLLAPSED_COOKIE, collapsed ? "1" : "0", {
    maxAge: 60 * 60 * 24 * 365,
    path: "/app",
    sameSite: "lax",
  });
}
