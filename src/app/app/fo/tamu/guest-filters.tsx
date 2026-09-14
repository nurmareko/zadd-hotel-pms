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
      className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white p-4"
    >
      <div className="relative w-full sm:w-96">
        <label htmlFor="guest-search" className="sr-only">
          Cari nama, telepon, nomor identitas, atau email tamu
        </label>
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          key={q}
          id="guest-search"
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Cari nama, telepon, identitas, atau email..."
          className="h-11 desktop:h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        />
      </div>
      <Button type="submit">Cari</Button>
      {q ? (
        <Link href="/app/fo/tamu" className={buttonVariants({ variant: "ghost" })}>
          <RotateCcw aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
          Atur Ulang
        </Link>
      ) : null}
      <span className="min-w-0 flex-1" />
      <div className="flex items-center gap-3">
        <span className="whitespace-nowrap text-sm font-medium text-slate-500">{resultCount} hasil</span>
        <Link href={exportHref} download prefetch={false} className={buttonVariants({ variant: "outline" })}>
          <Download aria-hidden="true" className="mr-1 h-4 w-4" />
          Ekspor CSV
        </Link>
      </div>
    </form>
  );
}
