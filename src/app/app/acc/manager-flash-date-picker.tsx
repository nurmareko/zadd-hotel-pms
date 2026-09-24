"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { isValidISODateOnly } from "@/lib/date-only";

export function ManagerFlashDatePicker({ selectedDate }: { selectedDate: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function handleChange(value: string) {
    if (!isValidISODateOnly(value) || value === selectedDate) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.set("date", value);
    const query = nextSearchParams.toString();

    startTransition(() => {
      router.replace(`${pathname}?${query}`);
    });
  }

  return (
    <div className="grid gap-1.5">
      <label className="text-xs font-semibold text-muted-foreground" htmlFor="manager-flash-date">
        Tanggal bisnis
      </label>
      <input
        aria-busy={isPending}
        className="h-10 rounded-md border border-input bg-white px-3 text-sm disabled:cursor-wait disabled:opacity-70"
        disabled={isPending}
        id="manager-flash-date"
        onChange={(event) => handleChange(event.target.value)}
        type="date"
        value={selectedDate}
      />
      {isPending ? (
        <span aria-live="polite" className="text-xs text-muted-foreground">
          Memuat laporan...
        </span>
      ) : null}
    </div>
  );
}