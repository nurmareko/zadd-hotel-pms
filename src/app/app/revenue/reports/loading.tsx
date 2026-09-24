export default function LoadingRevenueReports() {
  return (
    <main aria-busy="true" aria-label="Memuat laporan pendapatan" className="space-y-4 bg-slate-50 p-4 sm:p-5 md:space-y-6 lg:p-6">
      <span className="sr-only" role="status">Memuat laporan pendapatan…</span>
      <div aria-hidden="true" className="space-y-4 motion-safe:animate-pulse md:space-y-6">
        <div className="space-y-3"><div className="h-8 w-64 max-w-full rounded bg-slate-200" /><div className="h-4 w-80 max-w-full rounded bg-slate-200" /></div>
        <div className="h-56 rounded-lg border border-slate-200 bg-white sm:h-44" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-40 rounded-lg border border-slate-200 bg-white p-5"><div className="h-4 w-24 rounded bg-slate-200" /><div className="mt-4 h-8 w-3/4 rounded bg-slate-200" /><div className="mt-4 h-3 w-full rounded bg-slate-100" /></div>)}
        </div>
        <div className="h-28 rounded-lg bg-blue-50" />
        <div className="grid gap-4 xl:grid-cols-3"><div className="h-72 rounded-lg border border-slate-200 bg-white" /><div className="h-72 rounded-lg border border-slate-200 bg-white xl:col-span-2" /></div>
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"><div className="h-6 w-40 rounded bg-slate-200" />{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-9 rounded bg-slate-100" />)}</div>
      </div>
    </main>
  );
}
