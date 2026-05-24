import { AdminTableLoadingSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <AdminTableLoadingSkeleton
      titleWidth="w-64"
      subtitleWidth="w-80"
      actionCount={0}
      tabCount={2}
      filterFields={1}
      rows={8}
      cols={6}
      minWidth="760px"
    />
  );
}
