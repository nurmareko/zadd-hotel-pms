import { FormPageSkeleton } from "@/components/route-skeletons";

export default function Loading() {
  return (
      <FormPageSkeleton
        fieldRows={8}
        contentClassName="min-w-0"
        showHeader={false}
      />
    );
}
