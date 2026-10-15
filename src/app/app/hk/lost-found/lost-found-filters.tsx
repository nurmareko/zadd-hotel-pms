import Link from "next/link";
import { Download, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LOST_FOUND_CATEGORY_LABELS, LOST_FOUND_STATUS_LABELS } from "@/lib/lost-found/labels";
import type { LostFoundFilters as FilterValues } from "@/lib/lost-found/filters";

const fieldClass = "mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function LostFoundFilters({ filters, canExport }: { filters: FilterValues; canExport: boolean }) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, String(value));
  return <form action="/app/hk/lost-found" method="get" className="space-y-4 border-b p-4">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <label className="text-sm font-medium">Search items<input name="q" type="search" maxLength={200} defaultValue={filters.q ?? ""} className={fieldClass} placeholder="Code, item, name, phone or location" /></label>
      <label className="text-sm font-medium">Category<select name="category" defaultValue={filters.category ?? ""} className={fieldClass}><option value="">All Categories</option>{Object.entries(LOST_FOUND_CATEGORY_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label className="text-sm font-medium">Status<select name="status" defaultValue={filters.status ?? ""} className={fieldClass}><option value="">All Statuses</option>{Object.entries(LOST_FOUND_STATUS_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label className="text-sm font-medium">Room number<input name="room" maxLength={20} defaultValue={filters.room ?? ""} className={fieldClass} placeholder="All rooms" /></label>
    </div>
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1 text-sm font-medium sm:max-w-48">From date<input type="date" name="from" defaultValue={filters.from ?? ""} className={fieldClass} /></label>
      <label className="min-w-0 flex-1 text-sm font-medium sm:max-w-48">To date<input type="date" name="to" defaultValue={filters.to ?? ""} className={fieldClass} /></label>
      <Button type="submit" className="min-h-11"><Search aria-hidden="true" />Apply</Button>
      <Link href="/app/hk/lost-found" className="inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted"><RotateCcw className="size-4" aria-hidden="true" />Reset</Link>
      {canExport && <a href={`/app/hk/lost-found/export?${query}`} className="inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted sm:ml-auto"><Download className="size-4" aria-hidden="true" />Download CSV</a>}
    </div>
    <p className="text-xs text-muted-foreground">Dates use hotel time (WIB). CSV downloads use the applied filters and include claimant personal data.</p>
  </form>;
}
