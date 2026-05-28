import { FileText } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/prisma";

type NightReportPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NightReportPage({
  searchParams,
}: NightReportPageProps) {
  const params = (await searchParams) ?? {};
  const auditId = firstParam(params.auditId);

  if (auditId) {
    redirect(`/app/acc/reports/${auditId}`);
  }

  const latestAudit = await prisma.nightAudit.findFirst({
    orderBy: { businessDate: "desc" },
    select: { id: true },
  });

  if (!latestAudit) {
    return (
      <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
        <div className="mb-4">
          <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
            <span className="text-console-accent">▸ </span>
            Laporan Night Audit
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            Laporan tersedia setelah night audit pertama selesai.
          </p>
        </div>
        <EmptyState
          icon={FileText}
          title="Belum ada laporan audit"
          description="Jalankan night audit terlebih dahulu untuk membuat laporan."
          action={
            <Link
              className="inline-flex h-8 items-center justify-center border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
              href="/app/acc/night-audit"
            >
              Jalankan Night Audit
            </Link>
          }
        />
      </main>
    );
  }

  redirect(`/app/acc/reports/${latestAudit.id}`);
}
