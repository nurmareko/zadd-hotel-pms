import Link from "next/link";
import type { ReservationStatus } from "@prisma/client";
import { CalendarCheck } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";

export type ArrivalListRow = {
  id: number;
  guestLabel: string;
  roomTypeLabel: string;
  nights: number;
  status: ReservationStatus;
  reservationNo: string;
  href: string;
};

type ArrivalListProps = {
  rows: ArrivalListRow[];
  totalCount: number;
  limit: number;
  allHref: string;
};

function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  const isConfirmed = status === "CONFIRMED";

  return (
    <span
      className={`inline-flex h-5 items-center gap-1.5 border px-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${
        isConfirmed
          ? "border-status-oc-pip bg-status-oc-bg text-status-oc-fg"
          : "border-status-vc-pip bg-status-vc-bg text-status-vc-fg"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 ${
          isConfirmed ? "bg-status-oc-pip" : "bg-status-vc-pip"
        }`}
      />
      {isConfirmed ? "Confirmed" : "Checked In"}
    </span>
  );
}

export function ArrivalList({
  rows,
  totalCount,
  limit,
  allHref,
}: ArrivalListProps) {
  return (
    <section className="min-w-0 max-w-full border border-console-border bg-console-surface p-0">
      <div className="flex items-center justify-between gap-3 border-b border-console-border bg-console-surface px-3.5 py-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-console-ink">
          Expected Arrivals · Hari Ini
        </h2>
        <span className="num text-[10px] text-slate-500">
          {totalCount} reservasi
        </span>
      </div>

      <div className="max-w-full overflow-auto">
        <table className="w-full min-w-[454px] border-collapse text-[12px]">
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[15%]" />
            <col className="w-[16%]" />
            <col className="w-[8%]" />
            <col className="w-[18%]" />
            <col className="w-[19%]" />
          </colgroup>
          <thead>
            <tr>
              <th className="bg-console-ink px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                Reservasi
              </th>
              <th className="bg-console-ink px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                Tamu
              </th>
              <th className="bg-console-ink px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                Tipe
              </th>
              <th className="bg-console-ink px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                Malam
              </th>
              <th className="bg-console-ink px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                Status
              </th>
              <th className="bg-console-ink px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                {" "}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="odd:bg-console-surface even:bg-console-bg hover:bg-status-vc-bg"
                >
                  <td className="border-b border-console-border-soft px-2 py-[9px]">
                    <span className="num whitespace-nowrap font-semibold text-slate-900">
                      {row.reservationNo}
                    </span>
                  </td>
                  <td className="border-b border-console-border-soft px-2 py-[9px]">
                    <span className="whitespace-nowrap font-medium text-console-ink">
                      {row.guestLabel}
                    </span>
                  </td>
                  <td className="border-b border-console-border-soft px-2 py-[9px] text-slate-600">
                    {row.roomTypeLabel}
                  </td>
                  <td className="num border-b border-console-border-soft px-2 py-[9px] text-right">
                    {row.nights}
                  </td>
                  <td className="border-b border-console-border-soft px-2 py-[9px]">
                    <ReservationStatusBadge status={row.status} />
                  </td>
                  <td className="border-b border-console-border-soft px-2 py-[9px] text-right">
                    <Link
                      href={row.href}
                      className="inline-flex h-7 items-center justify-center border border-console-border bg-console-surface px-2 text-[10px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
                    >
                      Check-in
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3.5 py-3.5" colSpan={6}>
                  <EmptyState
                    icon={CalendarCheck}
                    title="Tidak ada kedatangan hari ini"
                    description="Reservasi confirmed untuk tanggal bisnis ini akan muncul di antrean check-in."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalCount > limit ? (
        <div className="border-t border-console-border bg-console-bg px-3.5 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.04em]">
          <Link className="text-console-ink hover:underline" href={allHref}>
            Lihat semua →
          </Link>
        </div>
      ) : null}
    </section>
  );
}
