import { CrudTablePageSkeleton } from "@/components/route-skeletons";

export default function Loading() {
  return (
    <CrudTablePageSkeleton
      cols={6}
      rows={14}
      hasFilter={false}
      hasDateNav
      actionCount={4}
      minWidth="1180px"
      titleWidth="w-24"
      subtitleWidth="w-56"
    />
  );
}
