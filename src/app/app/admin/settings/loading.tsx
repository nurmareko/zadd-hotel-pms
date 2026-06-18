import {
  CardSkeleton,
  PageHeaderSkeleton,
  Skeleton,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-4 text-foreground md:px-6 md:py-5">
      <PageHeaderSkeleton titleWidth="w-56" subtitleWidth="w-[360px]" />

      <div className="grid max-w-[1100px] gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <CardSkeleton rows={3} titleWidth="w-36" />
          <CardSkeleton rows={4} titleWidth="w-44" />
          <CardSkeleton rows={2} titleWidth="w-28" />
        </div>

        <aside className="space-y-3">
          <CardSkeleton rows={5} titleWidth="w-24" />
          <section className="rounded-2xl border border-border bg-card p-3.5">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end lg:flex-col-reverse">
              <Skeleton className="h-8 border border-border sm:w-24 lg:w-full" />
              <Skeleton className="h-8 border border-border sm:w-24 lg:w-full" />
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
