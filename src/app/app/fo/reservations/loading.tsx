import {
  FilterBarSkeleton,
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-4 text-slate-900 md:px-6 md:py-5">
      <PageHeaderSkeleton
        titleWidth="w-56"
        subtitleWidth="w-64"
        actionCount={1}
      />

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <FilterBarSkeleton fields={3} />
        <TableSkeleton rows={8} cols={10} minWidth="1100px" />
      </section>
    </main>
  );
}
