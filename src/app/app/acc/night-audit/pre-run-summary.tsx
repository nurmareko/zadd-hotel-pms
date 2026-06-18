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
    <div className="border border-blue-100 bg-blue-50/50 rounded-2xl p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-blue-600">
        {arrangement}
      </div>
      <div className="num mt-2 text-[28px] font-bold leading-none text-blue-900">
        {count}
      </div>
      <div className="mt-1.5 text-xs font-medium text-blue-700/80">reservasi in-house</div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="num font-semibold text-foreground">{value}</span>
    </div>
  );
}

export function PreRunSummary({ plan }: PreRunSummaryProps) {
  return (
    <div className="grid gap-4">
      {plan.warnings.length > 0 ? (
        <section className="border border-amber-200 bg-amber-50 rounded-2xl p-4 text-sm text-amber-900">
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-amber-800">
            Peringatan
          </div>
          <div className="mt-2 space-y-1 leading-5">
            {plan.warnings.map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </div>
        </section>
      ) : null}

      {plan.blockingErrors.length > 0 ? (
        <section className="border border-red-200 bg-red-50 rounded-2xl p-4 text-sm text-red-900">
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-red-800">
            Audit belum bisa dijalankan
          </div>
          <div className="mt-2 space-y-1 leading-5">
            {plan.blockingErrors.map((error) => (
              <div key={error}>{error}</div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="border border-border bg-card rounded-2xl">
        <div className="border-b border-border px-5 py-4 text-base font-semibold tracking-tight text-foreground rounded-t-2xl">
          {"PRE-RUN SUMMARY"}
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

            <div className="mt-3 overflow-auto border border-border">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="bg-background border-b border-border px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Reservasi
                    </th>
                    <th className="bg-background border-b border-border px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Tamu
                    </th>
                    <th className="bg-background border-b border-border px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Kamar
                    </th>
                    <th className="bg-background border-b border-border px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Arrangement
                    </th>
                    <th className="bg-background border-b border-border px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Lines
                    </th>
                    <th className="bg-background border-b border-border px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
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
                        className="border-b border-border/60 odd:bg-white even:bg-slate-50 hover:bg-accent/50"
                        key={reservation.id}
                      >
                        <td className="num px-4 py-3 font-semibold text-foreground">
                          {reservation.reservationNo}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {reservation.guestName}
                        </td>
                        <td className="num px-4 py-3 text-muted-foreground">
                          {reservation.roomNumber}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {reservation.arrangementType}
                        </td>
                        <td className="num px-4 py-3 text-right text-muted-foreground">
                          {reservation.lineItemCount}
                        </td>
                        <td className="num px-4 py-3 text-right font-semibold text-foreground">
                          {formatIDR(reservation.postingTotal)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="border border-border rounded-xl bg-slate-50 p-4 text-sm">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-foreground">
              Snapshot
            </div>
            <MetricRow
              label="In-house reservations"
              value={String(plan.inHouseCount)}
            />
            <MetricRow label="Line items" value={String(plan.lineItemCount)} />
            <MetricRow
              label="Pendapatan Kamar"
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
              <span>Total Pendapatan</span>
              <span className="num">{formatIDR(plan.totalRevenue)}</span>
            </div>
          </aside>
        </div>
      </section>

      <section className="border border-border bg-card rounded-2xl">
        <div className="border-b border-border px-5 py-4 text-base font-semibold tracking-tight text-foreground rounded-t-2xl">
          {"POSTING ARTICLES"}
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="bg-background border-b border-border px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Code
                </th>
                <th className="bg-background border-b border-border px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Article
                </th>
                <th className="bg-background border-b border-border px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Amount Source
                </th>
                <th className="bg-background border-b border-border px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Article Price
                </th>
              </tr>
            </thead>
            <tbody>
              {plan.postingArticles.map((article) => (
                <tr
                  className="border-b border-border/60 odd:bg-white even:bg-slate-50"
                  key={article.code}
                >
                  <td className="num px-4 py-3 font-semibold text-foreground">
                    {article.code}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {article.name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {article.amountSource === "reservation-rate"
                      ? "Reservation rateAmount"
                      : "Article defaultPrice"}
                  </td>
                  <td className="num px-4 py-3 text-right text-muted-foreground">
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
