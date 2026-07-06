import { redirect } from "next/navigation";

type OldNewReservationPageProps = {
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

export default async function OldNewReservationPage({
  searchParams,
}: OldNewReservationPageProps) {
  redirect(`/app/fo/reservasi/new${queryString(await searchParams)}`);
}
