"use client";

import { format } from "date-fns";
import { id as indonesianLocale } from "date-fns/locale";
import { Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { stopCleaning } from "./actions";
import { CleaningTimer } from "./cleaning-timer";

type ActiveCleaningPanelProps = {
  roomId: number;
  startedAt: Date;
  updatedByName: string;
};

export function ActiveCleaningPanel({
  roomId,
  startedAt,
  updatedByName,
}: ActiveCleaningPanelProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await stopCleaning(formData);

      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }

      toast.success("Pembersihan selesai, menunggu inspeksi");
      router.refresh();
    });
  }

  return (
    <section className="border border-console-border bg-console-surface">
      <div className="bg-console-ink px-3.5 py-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
          {"// Pembersihan Berlangsung"}
        </h2>
      </div>
      <form onSubmit={onSubmit} className="space-y-3.5 p-3.5">
        <input type="hidden" name="roomId" value={roomId} />

        <div className="text-[12px] text-slate-600">
          Dimulai{" "}
          <span className="font-semibold text-console-ink">
            {format(startedAt, "HH:mm", { locale: indonesianLocale })}
          </span>{" "}
          oleh {updatedByName}
        </div>

        <div className="border border-console-border-soft bg-console-bg p-4 text-center">
          <CleaningTimer startedAt={startedAt} />
        </div>

        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
            Catatan Pembersihan
          </span>
          <Textarea
            name="notes"
            placeholder="Observasi kamar, linen, amenity, atau maintenance"
            className="mt-1 min-h-24 rounded-none border-console-border bg-console-surface text-[12px]"
          />
        </label>

        <div className="space-y-3 border-t border-console-border-soft pt-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
            {"// Catatan Pembersihan (Opsional)"}
          </div>

          <div className="space-y-1.5">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
              Jumlah tamu di kamar
            </span>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                  Dewasa
                </span>
                <Input
                  name="reportedAdultCount"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  className="mt-1 h-9 rounded-none border-console-border bg-console-surface text-[12px]"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                  Anak
                </span>
                <Input
                  name="reportedChildCount"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  className="mt-1 h-9 rounded-none border-console-border bg-console-surface text-[12px]"
                />
              </label>
            </div>
            <p className="text-[11px] text-slate-500">
              Untuk verifikasi data Front Office
            </p>
          </div>

          <div className="space-y-1">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
              Pergantian linen
            </span>
            <label className="flex items-center gap-2 py-1 text-[12px] text-console-ink">
              <input
                name="linenChanged"
                type="checkbox"
                value="true"
                className="h-4 w-4 rounded-none border-console-border"
              />
              Sprei diganti
            </label>
            <label className="flex items-center gap-2 py-1 text-[12px] text-console-ink">
              <input
                name="towelChanged"
                type="checkbox"
                value="true"
                className="h-4 w-4 rounded-none border-console-border"
              />
              Handuk diganti
            </label>
          </div>
        </div>

        {error ? (
          <p className="border border-red-500 bg-status-od-bg px-3 py-2 text-[12px] text-status-od-fg">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={isPending}
          className="h-11 w-full rounded-none border-console-ink bg-console-ink text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
        >
          <Square className="h-4 w-4" aria-hidden="true" />
          {isPending ? "Menghentikan..." : "Hentikan Pembersihan"}
        </Button>
      </form>
    </section>
  );
}
