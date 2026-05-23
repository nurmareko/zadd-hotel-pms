import { AdminTableLoadingSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <AdminTableLoadingSkeleton
      titleWidth="w-40"
      subtitleWidth="w-80"
      kpiCount={3}
      filterFields={2}
      rows={8}
      cols={6}
      minWidth="760px"
    />
  );
}
