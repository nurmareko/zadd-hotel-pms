export default function PricingRulesLoading() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-4 md:px-6 md:py-5">
      <div className="space-y-4" aria-busy="true" aria-label="Memuat aturan harga">
        <div className="h-16 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-72 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-72 animate-pulse rounded-lg bg-slate-200" />
      </div>
    </main>
  );
}
