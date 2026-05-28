"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";

type TapeChartControlsProps = {
  previousHref: string;
  nextHref: string;
  todayHref: string;
  newReservationHref: string;
  rangeLabel: string;
};

export function TapeChartControls({
  previousHref,
  nextHref,
  todayHref,
  newReservationHref,
  rangeLabel,
}: TapeChartControlsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function navigate(href: string) {
    startTransition(() => {
      router.push(href);
    });
  }

  const controlClassName =
    "flex h-8 items-center justify-center border border-console-border bg-console-surface text-console-ink disabled:cursor-wait disabled:opacity-60";

  return (
    <div
      aria-busy={isPending}
      className="flex flex-wrap items-center gap-2"
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Tanggal sebelumnya"
          className={`${controlClassName} w-8`}
          disabled={isPending}
          onClick={() => navigate(previousHref)}
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <div className="flex h-8 items-center border border-console-border bg-console-surface px-3 text-[11px] font-semibold tracking-[0.04em]">
          <span className="num">{rangeLabel}</span>
        </div>
        <button
          type="button"
          aria-label="Tanggal berikutnya"
          className={`${controlClassName} w-8`}
          disabled={isPending}
          onClick={() => navigate(nextHref)}
        >
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        className={`${controlClassName} px-3 text-[11px] font-semibold uppercase tracking-[0.04em]`}
        disabled={isPending}
        onClick={() => navigate(todayHref)}
      >
        Hari Ini
      </button>
      <Link
        href={newReservationHref}
        className="flex h-8 items-center gap-1.5 border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Tambah Reservasi
      </Link>
    </div>
  );
}
