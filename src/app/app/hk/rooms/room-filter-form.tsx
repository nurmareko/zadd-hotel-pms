"use client";

import { RotateCcw, Search } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { PRIORITY_CONFIG } from "@/lib/housekeeping-priority";
import { cn } from "@/lib/utils";

const roomStatusLabels = {
  VC: "VC - Vacant Clean",
  OC: "OC - Occupied Clean",
  VD: "VD - Vacant Dirty",
  OD: "OD - Occupied Dirty",
  VCU: "VCU - Clean, Awaiting Inspection",
  OOO: "OOO - Out of Order",
};

const statusChips = [
  { key: "", label: "All", dotClass: "bg-slate-400" },
  { key: "VC", label: "VC · Vacant Clean", dotClass: "bg-emerald-500" },
  { key: "OC", label: "OC · Occupied Clean", dotClass: "bg-blue-500" },
  { key: "VD", label: "VD · Vacant Dirty", dotClass: "bg-amber-500" },
  { key: "OD", label: "OD · Occupied Dirty", dotClass: "bg-orange-500" },
  { key: "VCU", label: "VCU · Awaiting Inspection", dotClass: "bg-purple-500" },
  { key: "OOO", label: "OOO · Out of Order", dotClass: "bg-red-500" },
];

export function RoomFilterForm({
  dateIso,
  defaultQ,
  defaultStatus,
  defaultPriority,
  defaultFloor,
  defaultAssigneeId,
  floors,
  housekeepers,
  statusCounts,
  totalRoomsCount,
}: {
  dateIso: string;
  defaultQ: string;
  defaultStatus: string;
  defaultPriority: string;
  defaultFloor: string;
  defaultAssigneeId: string;
  floors: number[];
  housekeepers: { id: number; name: string }[];
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
    floor: defaultFloor,
    assigneeId: defaultAssigneeId,
  });
  const source = JSON.stringify([
    pathname,
    searchParams.toString(),
    dateIso,
    defaultQ,
    defaultStatus,
    defaultPriority,
    defaultFloor,
    defaultAssigneeId,
  ]);
  const [previousSource, setPreviousSource] = useState(source);
  if (source !== previousSource) {
    setPreviousSource(source);
    setFilters({
      q: defaultQ,
      status: defaultStatus,
      priority: defaultPriority,
      floor: defaultFloor,
      assigneeId: defaultAssigneeId,
    });
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
  const active = Object.values(filters).some(Boolean);

  return (
    <div>
      {/* Quick Status Chips Bar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border/60 bg-muted/20 px-3.5 py-2.5">
        <span className="mr-1 text-xs font-semibold text-muted-foreground">Filter by Status:</span>
        {statusChips.map((chip) => {
          const isSelected = filters.status === chip.key;
          const count = chip.key === "" ? totalRoomsCount : statusCounts?.[chip.key] ?? 0;

          return (
            <button
              key={chip.key}
              type="button"
              disabled={pending}
              aria-pressed={isSelected}
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
            placeholder="Search rooms (e.g. 101, 204), guests or attendants..."
            aria-label="Search rooms, task codes, guests or attendants..."
            className={`${controlClass} pl-9 sm:w-full`}
          />
        </div>
        <Button type="submit" disabled={pending}>
          <Search className="size-4" aria-hidden="true" />
          Search
        </Button>
        <select
          name="status"
          aria-label="Room status"
          value={filters.status}
          disabled={pending}
          onChange={(event) => navigate({ ...filters, status: event.target.value })}
          className={controlClass}
        >
          <option value="">All Statuses</option>
          {Object.entries(roomStatusLabels).map(([status, label]) => (
            <option key={status} value={status}>{label}</option>
          ))}
        </select>
        <select
          name="priority"
          aria-label="Room priority"
          value={filters.priority}
          disabled={pending}
          onChange={(event) => navigate({ ...filters, priority: event.target.value })}
          className={controlClass}
        >
          <option value="">All Priorities</option>
          {Object.entries(PRIORITY_CONFIG)
            .sort(([, a], [, b]) => a.rank - b.rank)
            .map(([code, config]) => (
              <option key={code} value={code}>{code} - {config.label}</option>
            ))}
        </select>
        <select
          name="floor"
          aria-label="Room floor"
          value={filters.floor}
          disabled={pending}
          onChange={(event) => navigate({ ...filters, floor: event.target.value })}
          className={controlClass}
        >
          <option value="">All Floors</option>
          {filters.floor && !floors.some((floor) => String(floor) === filters.floor) && (
            <option value={filters.floor} disabled>Floor {filters.floor} (unavailable)</option>
          )}
          {floors.map((floor) => (
            <option key={floor} value={floor}>Floor {floor}</option>
          ))}
        </select>
        <select
          name="assigneeId"
          aria-label="Assigned attendant"
          value={filters.assigneeId}
          disabled={pending}
          onChange={(event) => navigate({ ...filters, assigneeId: event.target.value })}
          className={`${controlClass} min-w-0 max-w-full`}
        >
          <option value="">All Attendants</option>
          <option value="unassigned">Unassigned</option>
          {filters.assigneeId && filters.assigneeId !== "unassigned" &&
            !housekeepers.some((housekeeper) => String(housekeeper.id) === filters.assigneeId) && (
              <option value={filters.assigneeId} disabled>Attendant ID {filters.assigneeId} (not in active staff list)</option>
            )}
          {housekeepers.map((housekeeper) => (
            <option key={housekeeper.id} value={housekeeper.id}>{housekeeper.name}</option>
          ))}
        </select>
        {active && (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => navigate({ q: "", status: "", priority: "", floor: "", assigneeId: "" })}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Reset
          </Button>
        )}
        <span role="status" className="text-xs text-muted-foreground">
          {pending ? "Loading..." : ""}
        </span>
      </form>
    </div>
  );
}
