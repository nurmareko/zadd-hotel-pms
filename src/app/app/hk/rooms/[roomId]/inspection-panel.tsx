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
    <Card className="rounded-lg p-0">
      <CardHeader className="border-b border-border rounded-t-lg px-5 py-4">
        <CardTitle className="text-[16px] font-semibold tracking-tight">
          Menunggu Inspeksi
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
      <form
        onSubmit={submitInspection}
        className="space-y-4 p-5"
      >
        <input type="hidden" name="roomId" value={roomId} />
        <p className="text-sm leading-relaxed text-muted-foreground">
          {cleaningSummary(latestCompletedCleaningSession)}
        </p>

        {latestCompletedCleaningSession && (latestCompletedCleaningSession.linenChanged || latestCompletedCleaningSession.towelChanged || latestCompletedCleaningSession.note) ? (
          <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2 text-sm">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amenities Diganti:</span>
              <ul className="list-inside list-disc mt-1 space-y-0.5 text-muted-foreground">
                <li>Linen / Seprei: {latestCompletedCleaningSession.linenChanged ? "YA" : "TIDAK"}</li>
                <li>Handuk: {latestCompletedCleaningSession.towelChanged ? "YA" : "TIDAK"}</li>
              </ul>
            </div>
            {latestCompletedCleaningSession.note ? (
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Catatan Housekeeper:</span>
                <p className="mt-0.5 text-sm text-muted-foreground italic">
                  &ldquo;{latestCompletedCleaningSession.note}&rdquo;
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">
            {isFailMode ? "Alasan kegagalan *" : "Catatan Inspeksi"}
          </span>
          <Textarea
            name="notes"
            placeholder="Catatan jika ada temuan saat inspeksi"
            aria-invalid={isFailMode && Boolean(error)}
            className="mt-1 min-h-24 rounded-md"
          />
        </label>

        {error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="submit"
            name="passed"
            value="true"
            size="lg"
            disabled={isPending}
            className="w-full rounded-md"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            Lulus Inspeksi (&rarr; VC)
          </Button>
          <Button
            type="submit"
            name="passed"
            value="false"
            size="lg"
            variant="outline"
            disabled={isPending}
            className="w-full rounded-md"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Gagal Inspeksi (&rarr; VD)
          </Button>
        </div>
      </form>
      </CardContent>
    </Card>
  );
}
