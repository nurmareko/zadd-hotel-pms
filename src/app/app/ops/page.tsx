import { ClipboardList, Timer } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { canAccessModule } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function OperationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canAccessModule(session.user.role, "operations")) {
    redirect("/app/forbidden");
  }

  return (
    <main className="min-h-screen space-y-4 bg-slate-50 p-4 text-foreground md:p-5 desktop:space-y-6 desktop:p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900 desktop:text-[32px]">
          Operasional Hotel
        </h1>
        <p className="text-sm text-slate-600">
          Halaman ini disiapkan untuk koordinasi layanan tamu. Alur kerja
          permintaan tamu dan laporan SLA belum diimplementasikan.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-2 desktop:gap-4">
        <section aria-labelledby="guest-requests-heading" className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm desktop:p-5">
          <div className="flex items-center gap-2 text-slate-900">
            <ClipboardList className="size-5 shrink-0" aria-hidden="true" />
            <h2 id="guest-requests-heading" className="text-base font-semibold">
              Permintaan Tamu
            </h2>
          </div>
          <span className="inline-flex min-h-6 items-center rounded-full bg-slate-100 px-2.5 text-xs font-semibold text-slate-600">
            Belum tersedia
          </span>
          <p className="text-sm leading-relaxed text-slate-600">
            Bagian ini disiapkan untuk pencatatan, penugasan, dan pemantauan
            permintaan tamu. Permintaan belum dapat dibuat atau diproses dari
            halaman ini.
          </p>
        </section>

        <section aria-labelledby="sla-report-heading" className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm desktop:p-5">
          <div className="flex items-center gap-2 text-slate-900">
            <Timer className="size-5 shrink-0" aria-hidden="true" />
            <h2 id="sla-report-heading" className="text-base font-semibold">
              Laporan SLA
            </h2>
          </div>
          <span className="inline-flex min-h-6 items-center rounded-full bg-slate-100 px-2.5 text-xs font-semibold text-slate-600">
            Belum tersedia
          </span>
          <p className="text-sm leading-relaxed text-slate-600">
            Bagian ini disiapkan untuk laporan waktu respons dan penyelesaian
            layanan. Pengukuran SLA dan penyajian laporan belum diimplementasikan;
            belum ada hasil pengukuran yang ditampilkan.
          </p>
        </section>
      </div>
    </main>
  );
}
