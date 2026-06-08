import {
  DetailPageSkeleton,
  FormPageSkeleton,
} from "@/components/route-skeletons";

export default function Loading() {
  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mx-auto max-w-[600px] space-y-3">
        <DetailPageSkeleton
          cardCount={1}
          rowsPerCard={6}
          withShell={false}
        />
        <FormPageSkeleton
          fieldRows={3}
          showHeader={false}
          withShell={false}
        />
      </div>
    </main>
  );
}
