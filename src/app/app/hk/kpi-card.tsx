type KpiCardProps = {
  label: string;
  value: number | string;
  sub: string;
};

export function KpiCard({ label, value, sub }: KpiCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-3.5">
      <div className="text-[9.5px] font-semibold font-medium tracking-tight text-slate-600">
        [ {label} ]
      </div>
      <div className="num mt-2 text-[22px] font-bold leading-tight text-slate-900">
        {value}
      </div>
      <div className="mt-1 text-[11px] text-slate-500">{sub}</div>
    </section>
  );
}
