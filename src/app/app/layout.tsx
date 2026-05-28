import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { NavShell } from "@/components/nav-shell";
import { getRoleNavBadges } from "@/lib/nav-badges";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const navBadges = await getRoleNavBadges(session.user.role);

  return (
    <NavShell
      initialNavBadges={navBadges}
      userRole={session.user.role}
      userFullName={session.user.fullName}
    >
      {children}
    </NavShell>
  );
}
