"use client";

import { RotateCcw, Search } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { PRIORITY_CONFIG } from "@/lib/housekeeping-priority";
import { cn } from "@/lib/utils";

const roomStatusLabels = {
  VC: "VC - Kosong bersih",
  OC: "OC - Terisi bersih",
  VD: "VD - Kosong kotor",
  OD: "OD - Terisi kotor",
  VCU: "VCU - Bersih, menunggu inspeksi",
  OOO: "OOO - Tidak dapat digunakan",
};

const statusChips = [
  { key: "", label: "Semua", dotClass: "bg-slate-400" },
  { key: "VC", label: "VC · Kosong Bersih", dotClass: "bg-emerald-500" },
  { key: "OC", label: "OC · Terisi Bersih", dotClass: "bg-blue-500" },
  { key: "VD", label: "VD · Kosong Kotor", dotClass: "bg-amber-500" },
  { key: "OD", label: "OD · Terisi Kotor", dotClass: "bg-orange-500" },
  { key: "VCU", label: "VCU · Inspeksi", dotClass: "bg-purple-500" },
  { key: "OOO", label: "OOO · Rusak", dotClass: "bg-red-500" },
];

export function RoomFilterForm({
  dateIso,
  defaultQ,
  defaultStatus,
  defaultPriority,
  statusCounts,
  totalRoomsCount,
}: {
  dateIso: string;
  defaultQ: string;
  defaultStatus: string;
  defaultPriority: string;
  statusCounts?: Record<string, number>;
  totalRoomsCount?: number;
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
    <div>
      {/* Quick Status Chips Bar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border/60 bg-muted/20 px-3.5 py-2.5">
        <span className="mr-1 text-xs font-semibold text-muted-foreground">Filter Status:</span>
        {statusChips.map((chip) => {
          const isSelected = filters.status === chip.key;
          const count = chip.key === "" ? totalRoomsCount : statusCounts?.[chip.key] ?? 0;

          return (
            <button
              key={chip.key}
              type="button"
              disabled={pending}
              onClick={() =>
                navigate({
                  ...filters,
                  status: isSelected && chip.key !== "" ? "" : chip.key,
                })
              }
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground shadow-xs"
                  : "border-border bg-card text-foreground hover:bg-muted/70",
              )}
            >
              <span className={cn("size-2 rounded-full", chip.dotClass)} />
              <span>{chip.label}</span>
              {count !== undefined ? (
                <span className="num opacity-80 font-normal">({count})</span>
              ) : null}
            </button>
          );
        })}
      </div>

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
            placeholder="Cari kamar (contoh: 101, 204), tamu, atau petugas..."
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
            Reset
          </Button>
        )}
        <span role="status" className="text-xs text-muted-foreground">
          {pending ? "Memuat..." : ""}
        </span>
      </form>
    </div>
  );
}
