"use client";

import { AlertTriangle, Play, X } from "lucide-react";
import { useState, useTransition } from "react";

import { ResultPanel } from "./result-panel";
import { runNightAudit, type NightAuditRunResult } from "./actions";

type RunButtonProps = {
  disabled?: boolean;
  disabledReason?: string;
};

export function RunButton({ disabled = false, disabledReason }: RunButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [result, setResult] = useState<NightAuditRunResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRun() {
    setResult(null);
    startTransition(async () => {
      const actionResult = await runNightAudit();
      setResult(actionResult);
      setIsConfirming(false);
    });
  }

  if (result?.ok) {
    return <ResultPanel summary={result.summary} />;
  }

  return (
    <section className="border border-console-border bg-console-surface">
      <div className="border-b border-console-border bg-console-ink px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
        {"EKSEKUSI"}
      </div>
      <div className="space-y-3 p-3.5 text-[12px]">
        {result && !result.ok ? (
          <div className="border border-status-od-pip bg-status-od-bg px-3 py-2 text-status-od-fg">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <div className="font-semibold uppercase tracking-[0.04em]">
                  Audit gagal
                </div>
                <div className="mt-1 leading-5">{result.error}</div>
              </div>
            </div>
          </div>
        ) : null}

        {disabled && disabledReason ? (
          <div className="border border-status-vd-pip bg-status-vd-bg px-3 py-2 text-status-vd-fg">
            {disabledReason}
          </div>
        ) : null}

        {isConfirming ? (
          <div className="border border-status-vd-pip bg-status-vd-bg p-3 text-status-vd-fg">
            <div className="font-bold uppercase tracking-[0.06em]">
              Konfirmasi Night Audit
            </div>
            <p className="mt-1 leading-5">
              Proses ini akan memposting charge ke semua folio in-house dan
              membuat snapshot audit untuk business date hari ini.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                className="inline-flex h-8 items-center justify-center gap-2 border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800 disabled:opacity-50"
                disabled={isPending}
                onClick={handleRun}
                type="button"
              >
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                {isPending ? "Memproses..." : "Konfirmasi Jalankan"}
              </button>
              <button
                className="inline-flex h-8 items-center justify-center gap-2 border border-console-border bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg disabled:opacity-50"
                disabled={isPending}
                onClick={() => setIsConfirming(false)}
                type="button"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Batal
              </button>
            </div>
          </div>
        ) : (
          <button
            className="inline-flex h-8 items-center justify-center gap-2 border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50"
            disabled={disabled || isPending}
            onClick={() => setIsConfirming(true)}
            type="button"
          >
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
            Jalankan Night Audit
          </button>
        )}
      </div>
    </section>
  );
}
