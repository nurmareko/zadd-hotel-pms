import Link from "next/link";
import type { ReservationStatus } from "@prisma/client";
import { CalendarCheck } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { hasSharedReservationStatusColor } from "@/lib/reservation-status-colors";

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
  const label = status.replaceAll("_", " ");

  if (hasSharedReservationStatusColor(status)) {
    return <StatusBadge label={label} reservationStatus={status} />;
  }

  return (
    <StatusBadge
      label={label}
      className="border-status-vc-pip bg-status-vc-bg text-status-vc-fg"
      pipClassName="bg-status-vc-pip"
    />
  );
}

export function ArrivalList({
  rows,
  totalCount,
  limit,
  allHref,
}: ArrivalListProps) {
  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">
          Expected Arrivals · Hari Ini
        </h2>
        <span className="text-sm font-medium text-slate-500">
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
              <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">
                Reservasi
              </th>
              <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">
                Tamu
              </th>
              <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">
                Tipe
              </th>
              <th className="bg-slate-50 px-4 py-3 text-right text-xs font-semibold text-slate-600">
                Malam
              </th>
              <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">
                Status
              </th>
              <th className="bg-slate-50 px-4 py-3 text-right text-xs font-semibold text-slate-600">
                {" "}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-slate-50 even:bg-slate-50/50"
                >
                  <td className="border-b border-slate-100 px-4 py-3">
                    <span className="whitespace-nowrap font-medium text-slate-900">
                      {row.reservationNo}
                    </span>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3">
                    <span className="whitespace-nowrap font-medium text-slate-900">
                      {row.guestLabel}
                    </span>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-slate-600">
                    {row.roomTypeLabel}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-right">
                    {row.nights}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3">
                    <ReservationStatusBadge status={row.status} />
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-right">
                    <Link
                      href={row.href}
                      className="inline-flex h-8 items-center justify-center rounded-md bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      Check-in
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-5 py-8" colSpan={6}>
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
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-right text-sm font-medium">
          <Link className="text-emerald-600 hover:text-emerald-700 hover:underline" href={allHref}>
            Lihat semua →
          </Link>
        </div>
      ) : null}
    </section>
  );
}
