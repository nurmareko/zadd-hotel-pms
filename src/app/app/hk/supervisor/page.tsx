import { ClipboardList } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { isHkSupervisor } from "@/auth.config";
import { EmptyState } from "@/components/ui/empty-state";

export default async function HkSupervisorPage() {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && !isHkSupervisor(session))
  ) {
    redirect("/app/forbidden");
  }

  return (
    <main className="min-h-screen bg-console-bg px-4 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4">
        <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
          <span className="text-console-accent">▸ </span>
          Supervisor dashboard
        </h1>
        <p className="mt-1 text-[11px] leading-5 text-slate-500">
          Coming next
        </p>
      </div>

      <EmptyState
        icon={ClipboardList}
        title="Supervisor dashboard — coming next"
        description="Forecast dan bulk assignment masuk Phase 3b."
        className="min-h-[280px] border-console-border bg-console-surface"
      />
    </main>
  );
}
