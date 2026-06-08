import { DetailPageSkeleton } from "@/components/route-skeletons";

export default function Loading() {
  return (
    <DetailPageSkeleton
      cardCount={1}
      rowsPerCard={2}
      contentClassName="max-w-2xl"
    />
  );
}
