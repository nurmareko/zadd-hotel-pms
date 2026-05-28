"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

const secondaryLinkClassName =
  "inline-flex h-8 items-center justify-center gap-1.5 border border-console-border bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink transition-colors hover:border-console-ink hover:bg-console-bg";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      role="alert"
      className="flex min-h-screen items-center justify-center bg-console-bg p-6"
    >
      <EmptyState
        icon={AlertTriangle}
        title="Sistem sedang bermasalah"
        description="Maaf, proses tidak dapat ditampilkan saat ini. Silakan coba lagi atau kembali ke dashboard."
        className="min-h-[280px] w-full max-w-xl border-console-border bg-console-surface px-6 py-10"
        action={
          <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Button
              type="button"
              onClick={reset}
              className="h-8 rounded-none border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800 hover:text-console-accent"
            >
              <RotateCcw size={14} aria-hidden="true" />
              Coba lagi
            </Button>
            <Link href="/app" className={secondaryLinkClassName}>
              <Home size={14} aria-hidden="true" />
              Ke dashboard
            </Link>
          </div>
        }
      />
    </main>
  );
}
