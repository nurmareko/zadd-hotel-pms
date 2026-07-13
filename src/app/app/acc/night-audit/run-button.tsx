"use client";

import { AlertTriangle, Play, X } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

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
    <section className="border border-border bg-card rounded-lg">
      <div className="border-b border-border px-5 py-4 text-base font-semibold tracking-tight text-foreground rounded-t-lg">
        {"EKSEKUSI"}
      </div>
      <div className="space-y-3 p-3.5 text-sm">
        {result && !result.ok ? (
          <div className="border border-red-200 bg-red-50 rounded-lg p-3 text-red-900">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
              <div>
                <div className="font-semibold uppercase tracking-[0.04em] text-red-800">
                  Audit gagal
                </div>
                <div className="mt-1 leading-5 text-sm">{result.error}</div>
              </div>
            </div>
          </div>
        ) : null}

        {disabled && disabledReason ? (
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-sm text-amber-900">
            {disabledReason}
          </div>
        ) : null}

        {isConfirming ? (
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 text-sm text-amber-900">
            <div className="font-bold uppercase tracking-[0.06em] text-amber-800">
              Konfirmasi Night Audit
            </div>
            <p className="mt-2 leading-5">
              Proses ini akan memposting charge ke semua folio in-house dan
              membuat snapshot audit untuk business date hari ini.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button
                disabled={isPending}
                onClick={handleRun}
                type="button"
              >
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                {isPending ? "Memproses..." : "Konfirmasi Jalankan"}
              </Button>
              <Button
                disabled={isPending}
                onClick={() => setIsConfirming(false)}
                type="button"
                variant="outline"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Batal
              </Button>
            </div>
          </div>
        ) : (
          <Button
            disabled={disabled || isPending}
            onClick={() => setIsConfirming(true)}
            type="button"
          >
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
            Jalankan Night Audit
          </Button>
        )}
      </div>
    </section>
  );
}
