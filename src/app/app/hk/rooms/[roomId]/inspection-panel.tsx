"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatTimeID } from "@/lib/format";

import { inspectRoom } from "./actions";

type InspectionPanelProps = {
  roomId: number;
  latestCompletedCleaningSession: {
    startedAt: Date;
    finishedAt: Date;
    housekeeperName: string;
  } | null;
};

function durationMinutes(startedAt: Date, finishedAt: Date) {
  return Math.max(
    1,
    Math.round((finishedAt.getTime() - startedAt.getTime()) / 60_000),
  );
}

function cleaningSummary(
  latestCompletedCleaningSession: InspectionPanelProps["latestCompletedCleaningSession"],
) {
  if (!latestCompletedCleaningSession) {
    return "Belum ada catatan pembersihan selesai untuk kamar ini.";
  }

  return `Dibersihkan oleh ${latestCompletedCleaningSession.housekeeperName} pada ${formatTimeID(
    latestCompletedCleaningSession.startedAt,
  )}, selesai ${formatTimeID(latestCompletedCleaningSession.finishedAt)} (${durationMinutes(
    latestCompletedCleaningSession.startedAt,
    latestCompletedCleaningSession.finishedAt,
  )} menit)`;
}

export function InspectionPanel({
  roomId,
  latestCompletedCleaningSession,
}: InspectionPanelProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isFailMode, setIsFailMode] = useState(false);
  const [isPending, startTransition] = useTransition();

  function runInspection(form: HTMLFormElement, passed: boolean) {
    setError(null);

    const formData = new FormData(form);
    formData.set("passed", passed ? "true" : "false");

    startTransition(async () => {
      const result = await inspectRoom(formData);

      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }

      toast.success(passed ? "Inspeksi lulus" : "Inspeksi gagal");
      router.refresh();
    });
  }

  function submitInspection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const passed = submitter?.value !== "false";
    const notes = new FormData(event.currentTarget).get("notes");

    setIsFailMode(!passed);

    if (!passed && (!notes || String(notes).trim().length === 0)) {
      const message = "Alasan kegagalan inspeksi wajib diisi";
      setError(message);
      toast.error(message);
      return;
    }

    runInspection(event.currentTarget, passed);
  }

  return (
    <section className="border border-console-border bg-console-surface">
      <div className="bg-console-ink px-3.5 py-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
          {"Menunggu Inspeksi"}
        </h2>
      </div>
      <form
        onSubmit={submitInspection}
        className="space-y-3.5 p-3.5"
      >
        <input type="hidden" name="roomId" value={roomId} />
        <p className="text-[12px] leading-relaxed text-slate-600">
          {cleaningSummary(latestCompletedCleaningSession)}
        </p>

        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
            {isFailMode ? "Alasan kegagalan *" : "Catatan Inspeksi"}
          </span>
          <Textarea
            name="notes"
            placeholder="Catatan jika ada temuan saat inspeksi"
            aria-invalid={isFailMode && Boolean(error)}
            className="mt-1 min-h-24 rounded-none border-console-border bg-console-surface text-[12px]"
          />
        </label>

        {error ? (
          <p className="border border-red-500 bg-status-od-bg px-3 py-2 text-[12px] text-status-od-fg">
            {error}
          </p>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="submit"
            name="passed"
            value="true"
            disabled={isPending}
            className="h-11 rounded-none border-console-ink bg-console-ink text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            Lulus Inspeksi (-&gt; VC)
          </Button>
          <Button
            type="submit"
            name="passed"
            value="false"
            disabled={isPending}
            className="h-11 rounded-none border border-console-border bg-console-surface text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Gagal Inspeksi (-&gt; VD)
          </Button>
        </div>
      </form>
    </section>
  );
}
