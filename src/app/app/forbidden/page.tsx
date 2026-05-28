import Link from "next/link";
import { Home, ShieldAlert } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";

const homeLinkClassName =
  "inline-flex h-8 items-center justify-center gap-1.5 border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent transition-colors hover:bg-slate-800";

export default function AppForbiddenPage() {
  return (
    <main className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-console-bg p-6">
      <EmptyState
        icon={ShieldAlert}
        title="Akses ditolak"
        description="Kode 403. Akun Anda tidak memiliki izin untuk membuka modul ini. Kembali ke dashboard sesuai peran untuk melanjutkan."
        className="min-h-[280px] w-full max-w-xl border-console-border bg-console-surface px-6 py-10"
        action={
          <Link href="/app" className={homeLinkClassName}>
            <Home size={14} aria-hidden="true" />
            Ke dashboard
          </Link>
        }
      />
    </main>
  );
}
