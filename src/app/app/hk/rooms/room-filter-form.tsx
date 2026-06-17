"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useRef, useTransition } from "react";

export function RoomFilterForm({
  dateIso,
  defaultQ,
  defaultStatus,
}: {
  dateIso: string;
  defaultQ: string;
  defaultStatus: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const timeoutRef = useRef<NodeJS.Timeout>(null);

  const updateFilters = useCallback(
    (key: string, value: string, debounce: boolean = false) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      const navigate = () => {
        startTransition(() => {
          router.push(`${pathname}?${params.toString()}`);
        });
      };

      if (debounce) {
        timeoutRef.current = setTimeout(navigate, 300);
      } else {
        navigate();
      }
    },
    [pathname, router, searchParams],
  );

  return (
    <form
      className="flex flex-wrap items-center gap-2 border-b border-console-border p-3.5"
      onSubmit={(e) => e.preventDefault()}
    >
      <input type="hidden" name="date" value={dateIso} />
      <div className="relative w-full sm:w-[200px]">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
        />
        <input
          type="search"
          name="q"
          defaultValue={defaultQ}
          onChange={(e) => updateFilters("q", e.target.value, true)}
          placeholder="Cari kamar..."
          className="h-8 w-full border border-slate-400 bg-console-surface pl-8 pr-2.5 text-[12px] font-medium text-console-ink outline-none placeholder:text-slate-400 focus:border-console-ink focus:shadow-[0_0_0_3px_rgba(15,23,42,0.08)]"
        />
      </div>
      <select
        name="status"
        defaultValue={defaultStatus}
        onChange={(e) => updateFilters("status", e.target.value)}
        className="h-8 w-full border border-slate-400 bg-console-surface px-2.5 text-[11px] font-medium text-console-ink outline-none focus:border-console-ink focus:shadow-[0_0_0_3px_rgba(15,23,42,0.08)] sm:w-[150px]"
      >
        <option value="">Semua Status</option>
        <option value="VC">VC - Vacant Clean</option>
        <option value="OC">OC - Occupied Clean</option>
        <option value="VD">VD - Vacant Dirty</option>
        <option value="OD">OD - Occupied Dirty</option>
        <option value="VCU">VCU - Vacant Clean Unchecked</option>
        <option value="OOO">OOO - Out of Order</option>
      </select>
      {isPending && (
        <span className="text-[11px] text-slate-400 italic ml-2">Loading...</span>
      )}
    </form>
  );
}
