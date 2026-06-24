import Link from "next/link";
import { Home, ShieldAlert } from "lucide-react";

const homeLinkClassName =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-4 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-slate-800";

export default function AppForbiddenPage() {
  return (
    <main className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-slate-50 p-6 font-jakarta text-slate-900">
      <section className="flex min-h-[280px] w-full max-w-xl flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-10 text-center shadow-sm">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <ShieldAlert size={22} aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-[24px] font-bold leading-tight text-slate-900">
          Akses ditolak
        </h1>
        <p className="mt-2 max-w-md text-[14px] leading-6 text-slate-500">
          Kode 403. Akun Anda tidak memiliki izin untuk membuka modul ini.
          Kembali ke dashboard sesuai peran untuk melanjutkan.
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
