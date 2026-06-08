import { CardListPageSkeleton } from "@/components/route-skeletons";

export default function Loading() {
  return (
    <CardListPageSkeleton
      cards={12}
      actionCount={1}
      formRows={3}
      cardGridClassName="lg:grid-cols-4 xl:grid-cols-6"
    />
  );
}
