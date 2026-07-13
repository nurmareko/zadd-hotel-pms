import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { buttonVariants } from "@/components/ui/button";
import { formatCompactDateTimeID, formatLongDateID } from "@/lib/format";
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
  return formatLongDateID(date);
}

function dateTimeLabel(date: Date) {
  return formatCompactDateTimeID(date);
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
    <main className="min-h-screen bg-slate-50 px-5 py-4 text-foreground md:px-6 md:py-5">
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Breadcrumb className="mb-2">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/app/acc">Accounting</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Riwayat Laporan</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Laporan Night Audit #{audit.id}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {businessDateLabel(audit.businessDate)} · dijalankan{" "}
            {dateTimeLabel(audit.runAt)} oleh {audit.runBy.fullName}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <ReportActions auditId={audit.id} />
          <Link
            className={buttonVariants({ variant: "outline" })}
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
