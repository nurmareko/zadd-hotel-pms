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
    <form aria-label="Filter batch linen" aria-busy={pending} className="space-y-3" onSubmit={(event) => {
      event.preventDefault();
      if (pending || invalidRange) return;
      const params = new URLSearchParams();
      new FormData(event.currentTarget).forEach((value, key) => {
        if (typeof value === "string" && value.trim()) params.set(key, value.trim());
      });
      startTransition(() => router.push(`/app/hk/laundry?${params.toString()}`));
    }}>
      <fieldset disabled={pending} className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <legend className="sr-only">Cari dan saring batch</legend>
        <label className="min-w-0 text-sm font-medium">Cari batch
          <input name="q" type="search" maxLength={200} defaultValue={filters.q} placeholder="Kode, vendor, atau catatan" className={controlClass} />
        </label>
        <label className="min-w-0 text-sm font-medium">Status
          <select name="status" defaultValue={filters.status} className={controlClass}>
            <option value="">Semua status</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-sm font-medium">Tipe linen
          <select name="itemType" defaultValue={filters.itemType} className={controlClass}>
            <option value="">Semua tipe linen</option>
            {Object.entries(ITEM_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-sm font-medium">Dikirim mulai
          <input name="startDate" type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} className={controlClass} />
        </label>
        <label className="min-w-0 text-sm font-medium">Dikirim sampai
          <input name="endDate" type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} className={controlClass} />
        </label>
      </fieldset>
      {invalidRange && <p role="alert" className="text-sm text-destructive">Tanggal akhir tidak boleh sebelum tanggal mulai.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="outline" disabled={pending || invalidRange}><Search className="size-4" aria-hidden="true" />{pending ? "Memuat..." : "Terapkan Filter"}</Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={() => startTransition(() => router.push("/app/hk/laundry"))}>Reset Filter</Button>
        <p className="text-xs text-muted-foreground">Tanggal pengiriman mengikuti waktu hotel (WIB). Ringkasan mencakup seluruh batch.</p>
      </div>
    </form>
  );
}
