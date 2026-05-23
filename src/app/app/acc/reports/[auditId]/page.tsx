import { format } from "date-fns";
import { id as indonesianLocale } from "date-fns/locale";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import { ReportActions } from "./report-actions";
import { ReportView } from "./report-view";

export const dynamic = "force-dynamic";

type NightAuditReportPageProps = {
  params: Promise<{ auditId: string }>;
};

function parseAuditId(value: string) {
  const auditId = Number(value);

  if (!Number.isInteger(auditId) || auditId <= 0) {
    notFound();
  }

  return auditId;
}

function businessDateLabel(date: Date) {
  return format(date, "d MMMM yyyy", { locale: indonesianLocale });
}

function dateTimeLabel(date: Date) {
  return format(date, "d MMM yyyy HH:mm", { locale: indonesianLocale });
}

export default async function NightAuditReportPage({
  params,
}: NightAuditReportPageProps) {
  const session = await auth();

  if (session?.user.role !== "ACC") {
    redirect("/app/forbidden");
  }

  const { auditId: auditIdParam } = await params;
  const auditId = parseAuditId(auditIdParam);

  const [audit, settings] = await Promise.all([
    prisma.nightAudit.findUnique({
      where: { id: auditId },
      include: { runBy: { select: { fullName: true } } },
    }),
    prisma.hotelSettings.findUnique({
      where: { id: 1 },
      select: { hotelName: true, address: true },
    }),
  ]);

  if (!audit) {
    notFound();
  }

  if (!settings) {
    throw new Error("Hotel settings not found");
  }

  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
            <span className="text-console-accent">▸ </span>
            Laporan Night Audit
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            {businessDateLabel(audit.businessDate)} · dijalankan{" "}
            {dateTimeLabel(audit.runAt)} oleh {audit.runBy.fullName}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <ReportActions auditId={audit.id} />
          <Link
            className="inline-flex h-8 items-center justify-center border border-console-border bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
            href="/app/acc"
          >
            Kembali
          </Link>
        </div>
      </div>

      <ReportView audit={audit} settings={settings} />
    </main>
  );
}
