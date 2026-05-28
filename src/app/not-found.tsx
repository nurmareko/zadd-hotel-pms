import type { Metadata } from "next";
import Link from "next/link";
import { FileQuestion, Home } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Halaman tidak ditemukan | ZADD Hotel PMS",
};

const homeLinkClassName =
  "inline-flex h-8 items-center justify-center gap-1.5 border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent transition-colors hover:bg-slate-800";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-console-bg p-6">
      <EmptyState
        icon={FileQuestion}
        title="Halaman tidak ditemukan"
        description="Alamat yang diminta tidak tersedia atau sudah dipindahkan. Kembali ke dashboard untuk melanjutkan operasional."
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
