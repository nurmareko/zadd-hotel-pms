import { AdminTableLoadingSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <AdminTableLoadingSkeleton
      titleWidth="w-64"
      subtitleWidth="w-80"
      actionCount={2}
      filterFields={2}
      rows={8}
      cols={6}
      minWidth="860px"
    />
  );
}
