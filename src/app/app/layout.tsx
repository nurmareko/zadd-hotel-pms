import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { NavShell } from "@/components/nav-shell";
import { getRoleNavBadges } from "@/lib/nav-badges";
import { NAV_SIDEBAR_COLLAPSED_COOKIE } from "@/lib/nav-preferences";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const navBadges = await getRoleNavBadges(session.user.role);
  const initialSidebarCollapsed =
    (await cookies()).get(NAV_SIDEBAR_COLLAPSED_COOKIE)?.value === "1";

  return (
    <NavShell
      initialNavBadges={navBadges}
      initialSidebarCollapsed={initialSidebarCollapsed}
      userRole={session.user.role}
      userIsSupervisor={session.user.isSupervisor}
      userFullName={session.user.fullName}
    >
      {children}
    </NavShell>
  );
}
