import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { formatCompactDateTimeID, formatIDR } from "@/lib/format";
import { buildNightAuditPlan } from "@/lib/night-audit";

import { PreRunSummary } from "./pre-run-summary";
import { RunButton } from "./run-button";

export const dynamic = "force-dynamic";

function CompletedState({
  audit,
  businessDateLabel,
}: {
  businessDateLabel: string;
  audit: NonNullable<Awaited<ReturnType<typeof buildNightAuditPlan>>["existingAudit"]>;
}) {
  return (
    <section className="border border-emerald-200 bg-emerald-50/50 rounded-lg overflow-hidden">
      <div className="border-b border-emerald-200 bg-emerald-100/50 px-5 py-4 text-xs font-bold uppercase tracking-[0.08em] text-emerald-900">
        {"COMPLETED"}
      </div>
      <div className="grid gap-3 p-5 text-sm text-emerald-900 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="text-[15px] font-bold uppercase tracking-[0.04em]">
            Night audit sudah selesai
          </div>
          <p className="mt-1 leading-5">
            Business date {businessDateLabel} dikunci pada{" "}
            {formatCompactDateTimeID(audit.runAt)}{" "}
            oleh {audit.runByName}.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Link
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              href={`/app/acc/reports/${audit.id}`}
            >
              Lihat Laporan
            </Link>
            <Link
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              href="/app/acc"
            >
              Kembali
            </Link>
          </div>
        </div>

        <aside className="border border-emerald-200 bg-white rounded-lg p-4 text-sm text-foreground">
          <div className="flex items-center justify-between gap-3 border-b border-border py-2">
            <span className="text-muted-foreground">Pendapatan Kamar</span>
            <span className="num font-semibold">{formatIDR(audit.roomRevenue)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-border py-2">
            <span className="text-muted-foreground">Pendapatan F&B</span>
            <span className="num font-semibold">{formatIDR(audit.fbRevenue)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-border py-2">
            <span className="text-muted-foreground">Pendapatan Lainnya</span>
            <span className="num font-semibold">{formatIDR(audit.otherRevenue)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 pt-3 text-[13px] font-bold uppercase tracking-[0.04em] text-emerald-900">
            <span>Total Pendapatan</span>
            <span className="num">{formatIDR(audit.totalRevenue)}</span>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default async function NightAuditPage() {
  const session = await auth();

  if (session?.user.role !== "ACC") {
    redirect("/app/forbidden");
  }

  const plan = await buildNightAuditPlan({ runById: Number(session.user.id) });
  const disabledReason =
    plan.blockingErrors.length > 0
      ? "Perbaiki prerequisite yang berstatus blocking sebelum menjalankan audit."
      : undefined;

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
                <BreadcrumbPage>Night Audit</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Eksekusi Night Audit
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Business date: {plan.businessDateLabel} ·{" "}
            {plan.existingAudit ? "Sudah diaudit" : "Belum diaudit"}
          </p>
        </div>
        <Link
          className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          href="/app/acc"
        >
          Kembali
        </Link>
      </div>

      <div className="grid gap-4">
        {plan.existingAudit ? (
          <>
            <CompletedState
              audit={plan.existingAudit}
              businessDateLabel={plan.businessDateLabel}
            />
            <RunButton
              disabled
              disabledReason={`Night audit ${plan.businessDateLabel} sudah dijalankan.`}
            />
          </>
        ) : (
          <>
            <PreRunSummary plan={plan} />
            <RunButton
              disabled={plan.blockingErrors.length > 0}
              disabledReason={disabledReason}
            />
          </>
        )}
      </div>
    </main>
  );
}
