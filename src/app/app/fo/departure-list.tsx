import Link from "next/link";

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
    return "text-status-od-fg";
  }

  if (roundedBalance < 0) {
    return "text-status-vd-fg";
  }

  return "text-status-vc-fg";
}

export function DepartureList({
  rows,
  totalCount,
  limit,
  allHref,
}: DepartureListProps) {
  return (
    <section className="border border-console-border bg-console-surface">
      <div className="flex items-center justify-between gap-3 border-b border-console-border bg-console-surface px-3.5 py-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-console-ink">
          Departures · Hari Ini
        </h2>
        <span className="num text-[10px] text-slate-500">
          {totalCount} reservasi
        </span>
      </div>

      <div className="overflow-auto">
        <table className="w-full min-w-[360px] border-collapse text-[12px]">
          <thead>
            <tr>
              <th className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                Kamar
              </th>
              <th className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                Tamu
              </th>
              <th className="bg-console-ink px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                Saldo
              </th>
              <th className="bg-console-ink px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
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
              <td className="num border-b border-console-border-soft px-3 py-[9px] font-semibold text-console-ink">
                {row.roomLabel.replace("Room ", "")}
              </td>
              <td className="border-b border-console-border-soft px-3 py-[9px] text-console-ink">
                {row.guestLabel}
              </td>
              <td
                className={`num border-b border-console-border-soft px-3 py-[9px] text-right font-semibold ${balanceClassName(
                  row.balance,
                )}`}
              >
                {row.balanceLabel}
              </td>
              <td className="border-b border-console-border-soft px-3 py-[9px] text-right">
                <Link
                  href={row.href}
                  className="inline-flex h-7 items-center justify-center border border-console-border bg-console-surface px-2.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
                >
                  Check-out
                </Link>
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td
              className="px-3.5 py-8 text-center text-[12px] text-slate-500"
              colSpan={4}
            >
              Tidak ada keberangkatan hari ini. :)
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
