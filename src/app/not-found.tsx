import type { Metadata } from "next";
import Link from "next/link";
import { FileQuestion, Home } from "lucide-react";

export const metadata: Metadata = {
  title: "Halaman tidak ditemukan | ZADD Hotel Management",
};

const homeLinkClassName =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-4 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-slate-800";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 font-jakarta text-slate-900">
      <section className="flex min-h-[280px] w-full max-w-xl flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-10 text-center shadow-sm">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
          <FileQuestion size={22} aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-[24px] font-bold leading-tight text-slate-900">
          Halaman tidak ditemukan
        </h1>
        <p className="mt-2 max-w-md text-[14px] leading-6 text-slate-500">
          Alamat yang diminta tidak tersedia atau sudah dipindahkan. Kembali ke
          dashboard untuk melanjutkan operasional.
        </p>
        <div className="mt-6">
          <Link href="/app" className={homeLinkClassName}>
            <Home size={16} aria-hidden="true" />
            Ke dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
