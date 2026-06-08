import { WorkflowPageSkeleton } from "@/components/route-skeletons";

export default function Loading() {
  return <WorkflowPageSkeleton summaryCount={2} actionRows={5} />;
}
