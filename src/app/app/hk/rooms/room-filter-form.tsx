"use client";

import { RotateCcw, Search } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { PRIORITY_CONFIG } from "@/lib/housekeeping-priority";

const roomStatusLabels = {
  VC: "VC - Kosong bersih",
  OC: "OC - Terisi bersih",
  VD: "VD - Kosong kotor",
  OD: "OD - Terisi kotor",
  VCU: "VCU - Bersih, menunggu inspeksi",
  OOO: "OOO - Tidak dapat digunakan",
};

export function RoomFilterForm({
  dateIso,
  defaultQ,
  defaultStatus,
  defaultPriority,
}: {
  dateIso: string;
  defaultQ: string;
  defaultStatus: string;
  defaultPriority: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [filters, setFilters] = useState({
    q: defaultQ,
    status: defaultStatus,
    priority: defaultPriority,
  });
  const source = JSON.stringify([
    pathname,
    searchParams.toString(),
    dateIso,
    defaultQ,
    defaultStatus,
    defaultPriority,
  ]);
  const [previousSource, setPreviousSource] = useState(source);
  if (source !== previousSource) {
    setPreviousSource(source);
    setFilters({ q: defaultQ, status: defaultStatus, priority: defaultPriority });
  }

  function navigate(next: typeof filters) {
    if (pending) return;
    setFilters(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", dateIso);
    for (const [key, value] of Object.entries(next)) {
      if (value.trim()) params.set(key, value.trim());
      else params.delete(key);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  const controlClass =
    "h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-ring disabled:cursor-wait disabled:opacity-50 desktop:h-10 sm:w-auto";
  const active = Boolean(filters.q || filters.status || filters.priority);

  return (
    <form
      aria-busy={pending}
      className="flex flex-wrap items-center gap-2 p-3.5"
      onSubmit={(event) => {
        event.preventDefault();
        navigate(filters);
      }}
    >
      <div className="relative w-full sm:min-w-80 sm:flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          name="q"
          value={filters.q}
          disabled={pending}
          onChange={(event) => setFilters({ ...filters, q: event.target.value })}
          placeholder="Cari kamar, kode tugas, tamu, petugas..."
          aria-label="Cari kamar, kode tugas, tamu, petugas..."
          className={`${controlClass} pl-9 sm:w-full`}
        />
      </div>
      <Button type="submit" disabled={pending}>
        <Search className="size-4" aria-hidden="true" />
        Cari
      </Button>
      <select
        name="status"
        aria-label="Status kamar"
        value={filters.status}
        disabled={pending}
        onChange={(event) => navigate({ ...filters, status: event.target.value })}
        className={controlClass}
      >
        <option value="">Semua Status</option>
        {Object.entries(roomStatusLabels).map(([status, label]) => (
          <option key={status} value={status}>{label}</option>
        ))}
      </select>
      <select
        name="priority"
        aria-label="Prioritas kamar"
        value={filters.priority}
        disabled={pending}
        onChange={(event) => navigate({ ...filters, priority: event.target.value })}
        className={controlClass}
      >
        <option value="">Semua Prioritas</option>
        {Object.entries(PRIORITY_CONFIG)
          .sort(([, a], [, b]) => a.rank - b.rank)
          .map(([code, config]) => (
            <option key={code} value={code}>{code} - {config.label}</option>
          ))}
      </select>
      {active && (
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => navigate({ q: "", status: "", priority: "" })}
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Atur Ulang
        </Button>
      )}
      <span role="status" className="text-xs text-muted-foreground">
        {pending ? "Memuat..." : ""}
      </span>
    </form>
  );
}
