"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { controlClass, ITEM_LABELS, STATUS_LABELS } from "./laundry-labels";

export type LaundryFilterValues = {
  q: string;
  status: string;
  itemType: string;
  startDate: string;
  endDate: string;
};

export function LaundryFilters({ filters }: { filters: LaundryFilterValues }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [startDate, setStartDate] = useState(filters.startDate);
  const [endDate, setEndDate] = useState(filters.endDate);
  const invalidRange = !!startDate && !!endDate && startDate > endDate;

  return (
    <form aria-label="Filter linen batches" aria-busy={pending} className="space-y-3" onSubmit={(event) => {
      event.preventDefault();
      if (pending || invalidRange) return;
      const params = new URLSearchParams();
      new FormData(event.currentTarget).forEach((value, key) => {
        if (typeof value === "string" && value.trim()) params.set(key, value.trim());
      });
      startTransition(() => router.push(`/app/hk/laundry?${params.toString()}`));
    }}>
      <fieldset disabled={pending} className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <legend className="sr-only">Search and filter batches</legend>
        <label className="min-w-0 text-sm font-medium">Search batches
          <input name="q" type="search" maxLength={200} defaultValue={filters.q} placeholder="Code, supplier or notes" className={controlClass} />
        </label>
        <label className="min-w-0 text-sm font-medium">Status
          <select name="status" defaultValue={filters.status} className={controlClass}>
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-sm font-medium">Linen type
          <select name="itemType" defaultValue={filters.itemType} className={controlClass}>
            <option value="">All linen types</option>
            {Object.entries(ITEM_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-sm font-medium">Sent from
          <input name="startDate" type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} className={controlClass} />
        </label>
        <label className="min-w-0 text-sm font-medium">Sent to
          <input name="endDate" type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} className={controlClass} />
        </label>
      </fieldset>
      {invalidRange && <p role="alert" className="text-sm text-destructive">The end date cannot be before the start date.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="outline" disabled={pending || invalidRange}><Search className="size-4" aria-hidden="true" />{pending ? "Loading..." : "Apply Filters"}</Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={() => startTransition(() => router.push("/app/hk/laundry"))}>Reset Filters</Button>
        <p className="text-xs text-muted-foreground">Dispatch dates use hotel time (WIB). The summary includes all batches.</p>
      </div>
    </form>
  );
}
