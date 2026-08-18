import { FileText } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
      <main className="min-h-screen bg-slate-50 px-5 py-4 text-foreground md:px-6 md:py-5">
        <div className="mb-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            
            Laporan Night Audit
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Laporan tersedia setelah night audit pertama selesai.
          </p>
        </div>
        <EmptyState
          icon={FileText}
          title="Belum ada laporan audit"
          description="Jalankan night audit terlebih dahulu untuk membuat laporan."
          action={
            <Link
              className={buttonVariants()}
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
