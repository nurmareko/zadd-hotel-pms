"use client";

import { useId, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function FBDatePicker({ date }: { date: string }) {
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="min-w-0" aria-busy={isPending}>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-600">
        Tanggal laporan (WIB)
      </label>
      <input
        key={date}
        id={id}
        type="date"
        defaultValue={date}
        required
        disabled={isPending}
        aria-describedby={`${id}-status`}
        className="num h-11 max-w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-slate-900 outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:cursor-wait disabled:opacity-60 desktop:h-10"
        onChange={(event) => {
          const nextDate = event.currentTarget.value;
          if (!event.currentTarget.validity.valid || !/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) return;
          const params = new URLSearchParams(searchParams.toString());
          params.set("tab", "dashboard");
          params.set("date", nextDate);
          startTransition(() => {
            router.push(`${pathname}?${params.toString()}`, { scroll: false });
          });
        }}
      />
      <span id={`${id}-status`} role="status" className="sr-only">
        {isPending ? "Memuat laporan tanggal terpilih…" : "Laporan siap ditampilkan."}
      </span>
      {isPending && <p className="mt-1 text-xs text-slate-600" aria-hidden="true">Memuat laporan…</p>}
    </div>
  );
}
