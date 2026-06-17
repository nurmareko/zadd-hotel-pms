"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatTimeID } from "@/lib/format";

import { inspectRoom } from "./actions";

type InspectionPanelProps = {
  roomId: number;
  latestCompletedCleaningSession: {
    startedAt: Date;
    finishedAt: Date;
    housekeeperName: string;
    note?: string | null;
    linenChanged?: boolean;
    towelChanged?: boolean;
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
    <Card className="rounded-2xl p-0">
      <CardHeader className="border-b border-border rounded-t-2xl px-5 py-4">
        <CardTitle className="text-[16px] font-semibold tracking-tight">
          Menunggu Inspeksi
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
      <form
        onSubmit={submitInspection}
        className="space-y-3.5 p-3.5"
      >
        <input type="hidden" name="roomId" value={roomId} />
         <p className="text-[12px] leading-relaxed text-slate-600">
          {cleaningSummary(latestCompletedCleaningSession)}
        </p>

        {latestCompletedCleaningSession && (latestCompletedCleaningSession.linenChanged || latestCompletedCleaningSession.towelChanged || latestCompletedCleaningSession.note) ? (
          <div className="border border-slate-100 bg-slate-50 p-3 space-y-2 text-[12px]">
            <div>
              <span className="text-[10px] font-bold font-medium tracking-tight text-slate-500">Amenities Diganti:</span>
              <ul className="list-inside list-disc mt-0.5 space-y-0.5 font-inter italic text-slate-600">
                <li>Linen / Seprei: {latestCompletedCleaningSession.linenChanged ? "YA" : "TIDAK"}</li>
                <li>Handuk: {latestCompletedCleaningSession.towelChanged ? "YA" : "TIDAK"}</li>
              </ul>
            </div>
            {latestCompletedCleaningSession.note ? (
              <div>
                <span className="text-[10px] font-bold font-medium tracking-tight text-slate-500">Catatan Housekeeper:</span>
                <p className="mt-0.5 font-inter text-slate-600 italic">
                  "{latestCompletedCleaningSession.note}"
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        <label className="block">
          <span className="text-[10px] font-semibold font-medium tracking-tight text-slate-500">
            {isFailMode ? "Alasan kegagalan *" : "Catatan Inspeksi"}
          </span>
          <Textarea
            name="notes"
            placeholder="Catatan jika ada temuan saat inspeksi"
            aria-invalid={isFailMode && Boolean(error)}
            className="mt-1 min-h-24 rounded-xl border-slate-300 bg-white text-[13px] text-slate-900 placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-500/20"
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
            className="h-10 w-full rounded-xl bg-slate-900 shadow-sm text-[13px] font-medium text-white hover:bg-slate-800"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            Lulus Inspeksi (-&gt; VC)
          </Button>
          <Button
            type="submit"
            name="passed"
            value="false"
            disabled={isPending}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white shadow-sm text-[13px] font-medium text-slate-700 hover:bg-slate-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Gagal Inspeksi (-&gt; VD)
          </Button>
        </div>
      </form>
      </CardContent>
    </Card>
  );
}
