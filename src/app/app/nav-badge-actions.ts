"use server";

import { auth } from "@/auth";
import { getRoleNavBadges } from "@/lib/nav-badges";
import type { NavBadgeMap } from "@/lib/nav-badge-types";

export async function getCurrentNavBadges(): Promise<NavBadgeMap> {
  const session = await auth();

  if (!session?.user) {
    return {};
  }

  return getRoleNavBadges(session.user.role);
}
