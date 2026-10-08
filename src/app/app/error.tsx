"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

const secondaryLinkClassName =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-xs transition-colors hover:bg-slate-50";

export default function AppError({
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
      className="flex min-h-[calc(100vh-10rem)] items-center justify-center p-4 md:p-6"
    >
      <section className="flex min-h-[260px] w-full max-w-lg flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-center shadow-xs md:p-8">
        <div className="flex size-12 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
          <AlertTriangle size={22} aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-xl font-bold leading-tight text-slate-900 md:text-2xl">
          Modul ini mengalami kendala
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
          Halaman tidak dapat ditampilkan saat ini. Navigasi tetap aktif sehingga
          Anda dapat berpindah modul atau mencoba memuat ulang halaman ini.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            onClick={reset}
            className="h-10 rounded-md border border-slate-900 bg-slate-900 px-4 text-sm font-semibold text-white shadow-xs hover:bg-slate-800"
          >
            <RotateCcw size={16} aria-hidden="true" />
            Coba lagi
          </Button>
          <Link href="/app" className={secondaryLinkClassName}>
            <Home size={16} aria-hidden="true" />
            Ke Beranda
          </Link>
        </div>
      </section>
    </main>
  );
}
