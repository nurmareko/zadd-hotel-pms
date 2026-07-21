import { WorkflowPageSkeleton } from "@/components/route-skeletons";

export default function Loading() {
  return (
      <WorkflowPageSkeleton summaryCount={3} actionRows={6} showHeader={false} />
    );
}
