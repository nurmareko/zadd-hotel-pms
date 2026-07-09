import { FilterBarSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <FilterBarSkeleton fields={3} />
      <TableSkeleton rows={8} cols={10} minWidth="1100px" />
    </section>
  );
}
