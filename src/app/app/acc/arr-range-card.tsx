import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addDateOnlyDays } from "@/lib/date-only";
import { formatCompactDateID, formatIDR } from "@/lib/format";

import type { ArrDisplayData } from "./arr-display";

type ArrRangeCardProps = {
  result: ArrDisplayData;
  fromValue: string;
  toValue: string;
  coverageLabel: string;
  validationError?: string;
};

function statusLabel(result: ArrDisplayData): string {
  if (result.status === "AUTHORITATIVE" && result.arr !== null) {
    return formatIDR(result.arr);
  }
  if (result.status === "NO_RECOGNIZED_NIGHTS") {
    return "N/A";
  }
  if (result.status === "INTEGRITY_ERROR") {
    return "Integrity error";
  }
  return "Tidak tersedia";
}

export function ArrRangeCard({
  result,
  fromValue,
  toValue,
  coverageLabel,
  validationError,
}: ArrRangeCardProps) {
  const cutover = new Date(`${result.cutoverDate}T00:00:00.000Z`);
  const requestedEnd = addDateOnlyDays(
    new Date(`${result.toExclusive}T00:00:00.000Z`),
    -1,
  );

  return (
    <Card className="mt-6 overflow-hidden rounded-lg border border-border p-0">
      <CardHeader className="rounded-none border-b border-border bg-card px-5 py-4">
        <CardTitle className="text-base font-semibold tracking-tight text-foreground">
          Average Room Rate (ARR) — Live
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <form className="grid content-start gap-3 sm:grid-cols-[1fr_1fr_auto]" method="get">
          <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
            Dari (inklusif)
            <input
              className="h-10 rounded-md border border-input bg-white px-3 text-sm font-normal text-foreground"
              defaultValue={fromValue}
              name="from"
              required
              type="date"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
            Sampai (inklusif)
            <input
              className="h-10 rounded-md border border-input bg-white px-3 text-sm font-normal text-foreground"
              defaultValue={toValue}
              name="to"
              required
              type="date"
            />
          </label>
          <button
            className="mt-auto h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            type="submit"
          >
            Terapkan
          </button>
          {validationError ? (
            <p className="text-sm text-red-700 sm:col-span-3">{validationError}</p>
          ) : null}
        </form>

        <div className="rounded-lg border border-border bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {coverageLabel}
          </div>
          <div className="num mt-1 text-3xl font-bold text-foreground">
            {statusLabel(result)}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Requested coverage</dt>
            <dd className="text-right font-medium">
              {formatCompactDateID(new Date(`${result.fromInclusive}T00:00:00.000Z`))}
              {" – "}
              {formatCompactDateID(requestedEnd)}
            </dd>
            <dt className="text-muted-foreground">Cutover</dt>
            <dd className="text-right font-medium">{formatCompactDateID(cutover)}</dd>
            <dt className="text-muted-foreground">Numerator</dt>
            <dd className="num text-right font-medium">{formatIDR(result.numerator)}</dd>
            <dt className="text-muted-foreground">Paid room nights</dt>
            <dd className="num text-right font-medium">{result.paidRoomNights}</dd>
          </dl>
          {result.reason ? (
            <p className="mt-3 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
              {result.reason}
            </p>
          ) : (
            <p className="mt-3 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
              Weighted aggregate: total posted paid room-charge amount divided by total recognized paid room nights. Daily ARRs are never averaged.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
