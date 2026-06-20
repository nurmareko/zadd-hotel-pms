import { LogOut } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";

export type DepartureListRow = {
  id: number;
  guestLabel: string;
  roomLabel: string;
  folioId: number;
  balance: number;
  balanceLabel: string;
  href: string;
};

type DepartureListProps = {
  rows: DepartureListRow[];
  totalCount: number;
  limit: number;
  allHref: string;
};

function balanceClassName(balance: number) {
  const roundedBalance = Math.round(balance);

  if (roundedBalance > 0) {
    return "text-red-600";
  }

  if (roundedBalance < 0) {
    return "text-amber-600";
  }

  return "text-emerald-600";
}

export function DepartureList({
  rows,
  totalCount,
  limit,
  allHref,
}: DepartureListProps) {
  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">
          Departures · Hari Ini
        </h2>
        <span className="text-sm font-medium text-slate-500">
          {totalCount} reservasi
        </span>
      </div>

      <div className="max-w-full overflow-auto">
        <table className="w-full min-w-[360px] border-collapse text-[12px]">
          <thead>
            <tr>
              <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">
                Kamar
              </th>
              <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">
                Tamu
              </th>
              <th className="bg-slate-50 px-4 py-3 text-right text-xs font-semibold text-slate-600">
                Saldo
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
              <td className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-900">
                {row.roomLabel.replace("Room ", "")}
              </td>
              <td className="border-b border-slate-100 px-4 py-3 text-slate-900 font-medium">
                {row.guestLabel}
              </td>
              <td
                className={`border-b border-slate-100 px-4 py-3 text-right font-semibold ${balanceClassName(
                  row.balance,
                )}`}
              >
                {row.balanceLabel}
              </td>
              <td className="border-b border-slate-100 px-4 py-3 text-right">
                <Link
                  href={row.href}
                  className="inline-flex h-8 items-center justify-center rounded-md bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  Check-out
                </Link>
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td className="px-5 py-8" colSpan={4}>
              <EmptyState
                icon={LogOut}
                title="Tidak ada keberangkatan hari ini"
                description="Folio tamu yang dijadwalkan check-out akan muncul di antrean ini."
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
