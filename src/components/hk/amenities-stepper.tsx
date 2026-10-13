"use client";

import { useId } from "react";

type AmenitiesStepperProps = {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
};

export function AmenitiesStepper({ label, value, onChange, min = 0, max = 99 }: AmenitiesStepperProps) {
  const labelId = useId();
  const buttonClass = "inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-background text-xl font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-wrap items-center justify-between gap-2 py-1">
      <span id={labelId} className="min-w-0 text-sm font-medium">{label}</span>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label={`Kurangi ${label}`}
          disabled={value === null}
          className={buttonClass}
          onClick={() => onChange(value === null || value <= Math.max(1, min) ? null : Math.max(min, value - 1))}
        >−</button>
        <output aria-live="polite" aria-atomic="true" aria-label={`Jumlah ${label}`} className="w-10 text-center text-sm tabular-nums">
          {value === null ? "–" : value}
        </output>
        <button
          type="button"
          aria-label={`Tambah ${label}`}
          disabled={value !== null && value >= max}
          className={buttonClass}
          onClick={() => onChange(Math.min(max, value === null ? Math.max(1, min) : value + 1))}
        >+</button>
      </div>
    </div>
  );
}
