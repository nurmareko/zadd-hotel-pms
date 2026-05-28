import { ArrangementType } from "@prisma/client";
import { BedDouble } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { formatIDR } from "@/lib/format";
import type { NightAuditPlan } from "@/lib/night-audit";

type PreRunSummaryProps = {
  plan: NightAuditPlan;
};

function ArrangementBadge({
  arrangement,
  count,
}: {
  arrangement: ArrangementType;
  count: number;
}) {
  return (
    <div className="border border-console-border bg-console-surface p-3">
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.10em] text-slate-600">
        {`[ ${arrangement} ]`}
      </div>
      <div className="num mt-2 text-[22px] font-bold leading-tight text-console-ink">
        {count}
      </div>
      <div className="mt-1 text-[11px] text-slate-500">reservasi in-house</div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-console-border-soft py-1.5">
      <span className="text-slate-500">{label}</span>
      <span className="num font-semibold text-console-ink">{value}</span>
    </div>
  );
}

export function PreRunSummary({ plan }: PreRunSummaryProps) {
  return (
    <div className="grid gap-4">
      {plan.warnings.length > 0 ? (
        <section className="border border-status-vd-pip bg-status-vd-bg p-3.5 text-[12px] text-status-vd-fg">
          <div className="text-[11px] font-bold uppercase tracking-[0.08em]">
            Peringatan
          </div>
          <div className="mt-1 space-y-1 leading-5">
            {plan.warnings.map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </div>
        </section>
      ) : null}

      {plan.blockingErrors.length > 0 ? (
        <section className="border border-status-od-pip bg-status-od-bg p-3.5 text-[12px] text-status-od-fg">
          <div className="text-[11px] font-bold uppercase tracking-[0.08em]">
            Audit belum bisa dijalankan
          </div>
          <div className="mt-1 space-y-1 leading-5">
            {plan.blockingErrors.map((error) => (
              <div key={error}>{error}</div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="border border-console-border bg-console-surface">
        <div className="border-b border-console-border bg-console-ink px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
          {"// PRE-RUN SUMMARY"}
        </div>
        <div className="grid gap-3 p-3.5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="grid gap-3 sm:grid-cols-3">
              <ArrangementBadge
                arrangement={ArrangementType.RO}
                count={plan.arrangementBreakdown.RO}
              />
              <ArrangementBadge
                arrangement={ArrangementType.RB}
                count={plan.arrangementBreakdown.RB}
              />
              <ArrangementBadge
                arrangement={ArrangementType.FBM}
                count={plan.arrangementBreakdown.FBM}
              />
            </div>

            <div className="mt-3 overflow-auto border border-console-border">
              <table className="w-full min-w-[760px] border-collapse text-[12px]">
                <thead>
                  <tr>
                    <th className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                      Reservasi
                    </th>
                    <th className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                      Tamu
                    </th>
                    <th className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                      Kamar
                    </th>
                    <th className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                      Arrangement
                    </th>
                    <th className="bg-console-ink px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                      Lines
                    </th>
                    <th className="bg-console-ink px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                      Total Posting
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {plan.reservations.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3" colSpan={6}>
                        <EmptyState
                          icon={BedDouble}
                          title="Tidak ada tamu in-house"
                          description="Tidak ada reservasi CHECKED_IN untuk business date ini."
                        />
                      </td>
                    </tr>
                  ) : (
                    plan.reservations.map((reservation) => (
                      <tr
                        className="border-b border-console-border-soft odd:bg-white even:bg-console-bg hover:bg-status-vc-bg"
                        key={reservation.id}
                      >
                        <td className="num px-3 py-[9px] font-semibold text-console-ink">
                          {reservation.reservationNo}
                        </td>
                        <td className="px-3 py-[9px] text-slate-700">
                          {reservation.guestName}
                        </td>
                        <td className="num px-3 py-[9px] text-slate-700">
                          {reservation.roomNumber}
                        </td>
                        <td className="px-3 py-[9px] text-slate-700">
                          {reservation.arrangementType}
                        </td>
                        <td className="num px-3 py-[9px] text-right text-slate-700">
                          {reservation.lineItemCount}
                        </td>
                        <td className="num px-3 py-[9px] text-right font-semibold text-console-ink">
                          {formatIDR(reservation.postingTotal)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="border border-console-border bg-console-bg p-3 text-[12px]">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-ink">
              Snapshot
            </div>
            <MetricRow
              label="In-house reservations"
              value={String(plan.inHouseCount)}
            />
            <MetricRow label="Line items" value={String(plan.lineItemCount)} />
            <MetricRow
              label="Room revenue"
              value={formatIDR(plan.roomRevenue)}
            />
            <MetricRow
              label="F&B inclusions"
              value={formatIDR(plan.fbInclusionRevenue)}
            />
            <MetricRow
              label="Closed F&B orders"
              value={formatIDR(plan.closedFbRevenue)}
            />
            <MetricRow
              label="Other folio revenue"
              value={formatIDR(plan.otherRevenue)}
            />
            <div className="flex items-center justify-between gap-3 pt-2 text-[13px] font-bold uppercase tracking-[0.04em]">
              <span>Total revenue</span>
              <span className="num">{formatIDR(plan.totalRevenue)}</span>
            </div>
          </aside>
        </div>
      </section>

      <section className="border border-console-border bg-console-surface">
        <div className="border-b border-console-border bg-console-ink px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
          {"// POSTING ARTICLES"}
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[720px] border-collapse text-[12px]">
            <thead>
              <tr>
                <th className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                  Code
                </th>
                <th className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                  Article
                </th>
                <th className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                  Amount Source
                </th>
                <th className="bg-console-ink px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                  Article Price
                </th>
              </tr>
            </thead>
            <tbody>
              {plan.postingArticles.map((article) => (
                <tr
                  className="border-b border-console-border-soft odd:bg-white even:bg-console-bg"
                  key={article.code}
                >
                  <td className="num px-3 py-[9px] font-semibold text-console-ink">
                    {article.code}
                  </td>
                  <td className="px-3 py-[9px] text-slate-700">
                    {article.name}
                  </td>
                  <td className="px-3 py-[9px] text-slate-700">
                    {article.amountSource === "reservation-rate"
                      ? "Reservation rateAmount"
                      : "Article defaultPrice"}
                  </td>
                  <td className="num px-3 py-[9px] text-right text-slate-700">
                    {article.amount ? formatIDR(article.amount) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
