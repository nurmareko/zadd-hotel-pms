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
      className="flex flex-wrap items-center gap-2 border-b border-border p-3.5"
      onSubmit={(e) => e.preventDefault()}
    >
      <input type="hidden" name="date" value={dateIso} />
      <div className="relative w-full sm:w-[240px]">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          name="q"
          defaultValue={defaultQ}
          onChange={(e) => updateFilters("q", e.target.value, true)}
          placeholder="Cari kamar..."
          aria-label="Cari kamar"
          className="h-11 w-full rounded-md border border-border bg-background pl-9 pr-3.5 text-sm font-normal text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-ring/15 focus:ring-4 focus:outline-none desktop:h-10"
        />
      </div>
      <select
        name="status"
        aria-label="Status kamar"
        defaultValue={defaultStatus}
        onChange={(e) => updateFilters("status", e.target.value)}
        className="h-11 w-full rounded-md border border-border bg-background px-3.5 text-sm font-normal text-foreground outline-none focus:border-ring focus:ring-ring/15 focus:ring-4 focus:outline-none desktop:h-10 sm:w-[180px]"
      >
        <option value="">Semua Status</option>
        <option value="VC">VC - Kosong bersih</option>
        <option value="OC">OC - Terisi bersih</option>
        <option value="VD">VD - Kosong kotor</option>
        <option value="OD">OD - Terisi kotor</option>
        <option value="VCU">VCU - Bersih, menunggu inspeksi</option>
        <option value="OOO">OOO - Tidak dapat digunakan</option>
      </select>
      {isPending && (
        <span className="text-xs text-muted-foreground italic ml-2">Memuat...</span>
      )}
    </form>
  );
}
