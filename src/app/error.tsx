"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

const secondaryLinkClassName =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-[14px] font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-50";

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
      className="flex min-h-screen items-center justify-center bg-slate-50 p-6 font-jakarta text-slate-900"
    >
      <section className="flex min-h-[280px] w-full max-w-xl flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-10 text-center shadow-sm">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <AlertTriangle size={22} aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-[24px] font-bold leading-tight text-slate-900">
          Sistem sedang bermasalah
        </h1>
        <p className="mt-2 max-w-md text-[14px] leading-6 text-slate-500">
          Maaf, proses tidak dapat ditampilkan saat ini. Silakan coba lagi atau
          kembali ke dashboard.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <Button
            type="button"
            onClick={reset}
            className="h-10 rounded-xl border border-slate-900 bg-slate-900 px-4 text-[14px] font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            <RotateCcw size={16} aria-hidden="true" />
            Coba lagi
          </Button>
          <Link href="/app" className={secondaryLinkClassName}>
            <Home size={16} aria-hidden="true" />
            Ke dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
