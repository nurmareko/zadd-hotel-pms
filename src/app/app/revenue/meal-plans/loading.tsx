export default function LoadingMealPlans() {
  return (
    <main className="space-y-6 bg-slate-50 p-4 md:p-6" aria-busy="true" aria-label="Memuat harga paket makan">
      <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
      <div className="h-80 animate-pulse rounded-lg bg-slate-200" />
    </main>
  );
}
