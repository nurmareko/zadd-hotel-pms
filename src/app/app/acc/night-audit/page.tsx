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
import { formatCompactDateTimeID } from "@/lib/format";
import { buildNightAuditPlan } from "@/lib/night-audit";

import { PreRunSummary } from "./pre-run-summary";
import { ResultPanel } from "./result-panel";
import { RunButton } from "./run-button";

export const dynamic = "force-dynamic";

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
          <ResultPanel
            summary={{
              auditId: plan.existingAudit.id,
              businessDateLabel: plan.businessDateLabel,
              runAtLabel: formatCompactDateTimeID(plan.existingAudit.runAt),
              runByName: plan.existingAudit.runByName,
              roomRevenue: plan.existingAudit.roomRevenue,
              fbRevenue: plan.existingAudit.fbRevenue,
              otherRevenue: plan.existingAudit.otherRevenue,
              totalRevenue: plan.existingAudit.totalRevenue,
              warnings: plan.warnings,
            }}
          />
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
