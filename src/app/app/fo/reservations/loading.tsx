import {
  FilterBarSkeleton,
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <PageHeaderSkeleton
        titleWidth="w-56"
        subtitleWidth="w-64"
        actionCount={1}
      />

      <section className="border border-console-border bg-console-surface">
        <FilterBarSkeleton fields={4} />
        <TableSkeleton rows={8} cols={9} minWidth="1020px" />
      </section>
    </main>
  );
}
