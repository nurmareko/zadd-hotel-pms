import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { NavShell } from "@/components/nav-shell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <NavShell
      userRole={session.user.role}
      userFullName={session.user.fullName}
    >
      {children}
    </NavShell>
  );
}
