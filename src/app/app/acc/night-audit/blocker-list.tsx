import { AlertTriangle, ExternalLink } from "lucide-react";
import Link from "next/link";

import { formatLongDateID } from "@/lib/format";
import type { NightAuditBlocker } from "@/lib/night-audit";

export function NightAuditBlockerList({
  blockers,
}: {
  blockers: NightAuditBlocker[];
}) {
  return (
    <div className="mt-3 grid gap-3" role="list">
      {blockers.map((blocker, index) => (
        <article
          className="rounded-lg border border-red-200 bg-white p-4 shadow-sm"
          key={`${blocker.kind}-${blocker.reservation?.id ?? "global"}-${blocker.affectedDate?.toISOString() ?? "none"}-${index}`}
          role="listitem"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  {blocker.reservation ? (
                    <Link
                      className="font-semibold text-foreground underline decoration-red-300 underline-offset-4 hover:text-red-800"
                      href={`/app/fo/reservasi/${blocker.reservation.id}`}
                    >
                      {blocker.reservation.reservationNo} —{" "}
                      {blocker.reservation.guestName}
                      <ExternalLink
                        aria-hidden="true"
                        className="ml-1 inline h-3.5 w-3.5"
                      />
                    </Link>
                  ) : (
                    <div className="font-semibold text-foreground">
                      Konfigurasi Night Audit
                    </div>
                  )}
                  {blocker.reservation ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Kamar {blocker.reservation.roomNumber ?? "belum ditentukan"} ·{" "}
                      Kedatangan {formatLongDateID(blocker.reservation.arrivalDate)} ·{" "}
                      Keberangkatan{" "}
                      {formatLongDateID(blocker.reservation.departureDate)} · Status{" "}
                      {blocker.reservation.status}
                    </div>
                  ) : null}
                </div>
                {blocker.affectedDate ? (
                  <div className="shrink-0 rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800">
                    {blocker.isFutureDate ? "Tanggal mendatang" : "Tanggal terdampak"}: {" "}
                    {formatLongDateID(blocker.affectedDate)}
                  </div>
                ) : null}
              </div>

              {blocker.folio ? (
                <Link
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-red-800 underline decoration-red-300 underline-offset-4 hover:text-red-950"
                  href={`/app/fo/folios/${blocker.folio.id}`}
                >
                  Folio {blocker.folio.folioNo} · {blocker.folio.status}
                  <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                </Link>
              ) : null}

              <dl className="mt-3 grid gap-3 text-sm leading-6 md:grid-cols-2">
                <div>
                  <dt className="text-xs font-bold uppercase tracking-[0.06em] text-red-800">
                    Risiko
                  </dt>
                  <dd className="mt-1 text-slate-700">{blocker.explanation}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-[0.06em] text-red-800">
                    Tindakan
                  </dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {blocker.resolution}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
