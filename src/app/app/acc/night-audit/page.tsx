import Link from "next/link";
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
    <section className="border border-status-vc-pip bg-status-vc-bg">
      <div className="border-b border-status-vc-pip bg-console-ink px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
        {"COMPLETED"}
      </div>
      <div className="grid gap-3 p-3.5 text-[12px] text-status-vc-fg lg:grid-cols-[minmax(0,1fr)_320px]">
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
              className="inline-flex h-8 items-center justify-center border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
              href={`/app/acc/reports/${audit.id}`}
            >
              Lihat Laporan
            </Link>
            <Link
              className="inline-flex h-8 items-center justify-center border border-console-border bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
              href="/app/acc"
            >
              Kembali
            </Link>
          </div>
        </div>

        <aside className="border border-status-vc-pip bg-white p-3 text-[12px] text-console-ink">
          <div className="flex items-center justify-between gap-3 border-b border-console-border-soft py-1.5">
            <span className="text-slate-500">Pendapatan Kamar</span>
            <span className="num font-semibold">{formatIDR(audit.roomRevenue)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-console-border-soft py-1.5">
            <span className="text-slate-500">Pendapatan F&B</span>
            <span className="num font-semibold">{formatIDR(audit.fbRevenue)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-console-border-soft py-1.5">
            <span className="text-slate-500">Pendapatan Lainnya</span>
            <span className="num font-semibold">{formatIDR(audit.otherRevenue)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 pt-2 text-[13px] font-bold uppercase tracking-[0.04em]">
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
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
            <span className="text-console-accent">▸ </span>
            Night Audit
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            Business date: {plan.businessDateLabel} ·{" "}
            {plan.existingAudit ? "Sudah diaudit" : "Belum diaudit"}
          </p>
        </div>
        <Link
          className="inline-flex h-8 items-center justify-center border border-console-border bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
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
