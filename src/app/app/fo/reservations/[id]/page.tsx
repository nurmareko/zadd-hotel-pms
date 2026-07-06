import { redirect } from "next/navigation";

type OldReservationDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function queryString(params: Record<string, string | string[] | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, item));
    } else if (value !== undefined) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();

  return query ? `?${query}` : "";
}

export default async function OldReservationDetailPage({
  params,
  searchParams,
}: OldReservationDetailPageProps) {
  const { id } = await params;

  redirect(`/app/fo/reservasi/${id}${queryString(await searchParams)}`);
}
