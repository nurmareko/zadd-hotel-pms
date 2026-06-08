import { CrudTablePageSkeleton } from "@/components/route-skeletons";

export default function Loading() {
  return (
    <CrudTablePageSkeleton
      cols={7}
      rows={8}
      hasTabs
      tabCount={2}
      hasFilter
      filterFields={2}
      actionCount={1}
      kpiCount={3}
      minWidth="860px"
      titleWidth="w-56"
      subtitleWidth="w-[420px]"
    />
  );
}
