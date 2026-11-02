import { Download, RotateCcw, Search } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";

export function buildExportQuery(filters: { q: string }): string {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  return query.toString();
}

export function GuestFilters({ q, resultCount }: { q: string; resultCount: number }) {
  const query = buildExportQuery({ q });
  const exportHref = `/app/fo/tamu/export${query ? `?${query}` : ""}`;

  return (
    <form
      action="/app/fo/tamu"
      method="get"
      className="flex flex-wrap items-end gap-3 border-b border-slate-200 bg-white p-4 desktop:p-5"
    >
      <div className="w-full space-y-1.5 sm:w-96">
        <label htmlFor="guest-search" className="block text-sm font-medium text-slate-700">
          Search Guests
        </label>
        <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          key={q}
          id="guest-search"
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search name, phone, ID, or email..."
          className="h-11 desktop:h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        </div>
      </div>
      <Button type="submit">Search</Button>
      {q ? (
        <Link href="/app/fo/tamu" className={buttonVariants({ variant: "ghost" })}>
          <RotateCcw aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
          Reset
        </Link>
      ) : null}
      <div className="flex w-full flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 xl:ml-auto xl:w-auto xl:border-0 xl:pt-0">
        <span role="status" className="whitespace-nowrap text-sm text-slate-500"><span className="font-semibold tabular-nums text-slate-900">{resultCount}</span> guests found</span>
        <Link href={exportHref} download prefetch={false} className={buttonVariants({ variant: "outline" })}>
          <Download aria-hidden="true" className="mr-1 h-4 w-4" />
          Export CSV
        </Link>
      </div>
    </form>
  );
}
