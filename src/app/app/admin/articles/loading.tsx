import { AdminTableLoadingSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <AdminTableLoadingSkeleton
      titleWidth="w-72"
      subtitleWidth="w-[420px]"
      filterFields={1}
      rows={8}
      cols={5}
      minWidth="760px"
    />
  );
}
