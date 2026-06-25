type KpiCardProps = {
  label: string;
  value: number | string;
  sub: string;
};

export function KpiCard({ label, value, sub }: KpiCardProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold leading-tight text-slate-900">
        {value}
      </div>
      <div className="mt-1 text-sm text-slate-500">{sub}</div>
    </section>
  );
}
