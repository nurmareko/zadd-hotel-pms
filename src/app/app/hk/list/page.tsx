import { redirect } from "next/navigation";

type SearchParams = {
  [key: string]: string | string[] | undefined;
};

function roomsHref(searchParams: SearchParams) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
      continue;
    }

    if (value) {
      params.set(key, value);
    }
  }

  const query = params.toString();

  return query ? `/app/hk/rooms?${query}` : "/app/hk/rooms";
}

export default async function HkListRedirectPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  redirect(roomsHref(await searchParams));
}
