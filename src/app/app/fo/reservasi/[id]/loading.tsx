import { DetailPageSkeleton } from "@/components/route-skeletons";

export default function Loading() {
  return (
    <DetailPageSkeleton
      cardCount={2}
      rowsPerCard={6}
      hasTabs
      showHeader={false}
      contentClassName="max-w-6xl"
    />
  );
}
