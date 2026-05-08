type KpiCardProps = {
  label: string;
  value: number | string;
  sub: string;
};

export function KpiCard({ label, value, sub }: KpiCardProps) {
  return (
    <section className="border border-console-border bg-console-surface p-3.5">
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.10em] text-slate-600">
        {label}
      </div>
      <div className="num mt-2 text-[22px] font-bold leading-tight text-console-ink">
        {value}
      </div>
      <div className="mt-1 text-[11px] text-slate-500">{sub}</div>
    </section>
  );
}
