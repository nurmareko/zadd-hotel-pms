"use client";

import { Archive, Check, Play, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatTimeID } from "@/lib/format";

import { finishCleaning, logFoundItem, startCleaning } from "./actions";
import { CleaningTimer } from "./cleaning-timer";

type WorkContext = {
  label: string;
  guestName: string;
  detail: string | null;
  notes: string | null;
} | null;

type HousekeeperWorkPanelProps = {
  roomId: number;
  roomNumber: string;
  canStart: boolean;
  canFinish: boolean;
  activeCleaningSession: {
    startedAt: Date;
    housekeeperName: string;
  } | null;
  latestCompletedCleaningSession: {
    finishedAt: Date;
  } | null;
  workContext: WorkContext;
  isTurnover?: boolean;
};

export function HousekeeperWorkPanel({
  roomId,
  roomNumber,
  canStart,
  canFinish,
  activeCleaningSession,
  latestCompletedCleaningSession,
  workContext,
  isTurnover = false,
}: HousekeeperWorkPanelProps) {
  const router = useRouter();
  const foundItemFormRef = useRef<HTMLFormElement>(null);
  const [foundItemError, setFoundItemError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isFoundItemPending, startFoundItemTransition] = useTransition();

  const [linenChanged, setLinenChanged] = useState(false);
  const [towelChanged, setTowelChanged] = useState(false);
  const [cleaningNote, setCleaningNote] = useState("");

  function handleFinishCleaning() {
    const formData = new FormData();
    formData.set("roomId", String(roomId));
    formData.set("linenChanged", String(linenChanged));
    formData.set("towelChanged", String(towelChanged));
    formData.set("note", cleaningNote);

    startTransition(async () => {
      const result = await finishCleaning(formData);

      if (!result.ok) {
        toast.error(result.error ?? "Gagal menyelesaikan pembersihan");
        return;
      }

      toast.success("Pembersihan selesai");
      setLinenChanged(false);
      setTowelChanged(false);
      setCleaningNote("");
      router.refresh();
    });
  }

  function runRoomAction(
    action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>,
    successMessage: string,
  ) {
    const formData = new FormData();
    formData.set("roomId", String(roomId));

    startTransition(async () => {
      const result = await action(formData);

      if (!result.ok) {
        toast.error(result.error ?? "Aksi gagal");
        return;
      }

      toast.success(successMessage);
      router.refresh();
    });
  }

  function submitFoundItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFoundItemError(null);

    const formData = new FormData(event.currentTarget);

    startFoundItemTransition(async () => {
      const result = await logFoundItem(formData);

      if (!result.ok) {
        setFoundItemError(result.error);
        toast.error(result.error);
        return;
      }

      toast.success("Barang temuan dicatat");
      foundItemFormRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <Card className="rounded-lg p-0">
      <CardHeader className="border-b border-border rounded-t-lg px-5 py-4">
        <CardTitle className="text-[16px] font-semibold tracking-tight">
          Tugas Housekeeper
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3.5 p-3.5">
        {workContext ? (
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="text-xs font-medium text-muted-foreground">
              {workContext.label}
            </div>
            <div className="mt-1 text-sm font-semibold text-foreground">
              {workContext.guestName}
              {workContext.detail ? (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · {workContext.detail}
                </span>
              ) : null}
            </div>
            {workContext.notes ? (
              <p className="mt-2 border-l-2 border-status-vcu-pip bg-status-vcu-bg px-3 py-2 text-xs leading-5 rounded-r-lg text-foreground">
                {workContext.notes}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
            Tidak ada catatan reservasi aktif untuk kamar ini.
          </p>
        )}

        {activeCleaningSession ? (
          <div className="space-y-4 rounded-lg border border-border bg-muted/40 p-4">
            <div className="text-xs font-medium text-muted-foreground text-center">
              Berlangsung · dimulai {formatTimeID(activeCleaningSession.startedAt)}
            </div>
            <div className="text-center">
              <CleaningTimer startedAt={activeCleaningSession.startedAt} />
            </div>
            {canFinish ? (
              <div className="space-y-4 border-t border-border pt-4 text-left">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Checklist Amenities
                </p>
                
                <div className="space-y-2.5">
                  <label className="flex min-h-11 items-center gap-2.5 text-sm font-medium text-foreground cursor-pointer select-none desktop:min-h-10">
                    <input
                      type="checkbox"
                      checked={linenChanged}
                      onChange={(e) => setLinenChanged(e.target.checked)}
                      className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary cursor-pointer"
                    />
                    <span>Linen diganti (Ganti Sprei) {isTurnover && <span className="text-destructive font-semibold">*wajib</span>}</span>
                  </label>

                  <label className="flex min-h-11 items-center gap-2.5 text-sm font-medium text-foreground cursor-pointer select-none desktop:min-h-10">
                    <input
                      type="checkbox"
                      checked={towelChanged}
                      onChange={(e) => setTowelChanged(e.target.checked)}
                      className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary cursor-pointer"
                    />
                    <span>Handuk diganti {isTurnover && <span className="text-destructive font-semibold">*wajib</span>}</span>
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Catatan Pembersihan (Opsional)
                  </label>
                  <Textarea
                    placeholder="Catatan tambahan kondisi kamar..."
                    value={cleaningNote}
                    onChange={(e) => setCleaningNote(e.target.value)}
                    maxLength={500}
                    className="min-h-16 rounded-md"
                  />
                </div>

                <Button
                  type="button"
                  size="lg"
                  disabled={isPending || (isTurnover && (!linenChanged || !towelChanged))}
                  onClick={handleFinishCleaning}
                  className="w-full rounded-md"
                >
                  <Square className="h-4 w-4" aria-hidden="true" />
                  {isPending ? "Menyelesaikan..." : "Selesai Bersihkan"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {!activeCleaningSession && canStart ? (
          <Button
            type="button"
            size="lg"
            disabled={isPending}
            onClick={() => runRoomAction(startCleaning, "Pembersihan dimulai")}
            className="w-full rounded-md"
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            {isPending ? "Memulai..." : "Mulai Bersihkan"}
          </Button>
        ) : null}

        {!activeCleaningSession && !canStart ? (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
            <Check className="h-4 w-4 text-green-600" aria-hidden="true" />
            {latestCompletedCleaningSession
              ? `Selesai ${formatTimeID(latestCompletedCleaningSession.finishedAt)}`
              : "Tidak ada aksi pembersihan yang tersedia untuk status kamar ini."}
          </div>
        ) : null}

        <form
          ref={foundItemFormRef}
          onSubmit={submitFoundItem}
          className="space-y-2 border-t border-border pt-4"
        >
          <input type="hidden" name="roomId" value={roomId} />
          <label
            htmlFor={`found-item-${roomId}`}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide"
          >
            <Archive className="h-3.5 w-3.5" aria-hidden="true" />
            Catat barang temuan
          </label>
          <Textarea
            id={`found-item-${roomId}`}
            name="description"
            required
            minLength={3}
            maxLength={500}
            placeholder={`Deskripsi barang di kamar ${roomNumber}`}
            aria-invalid={Boolean(foundItemError)}
            className="min-h-16 rounded-md"
          />
          {foundItemError ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {foundItemError}
            </p>
          ) : null}
          <Button
            type="submit"
            size="lg"
            variant="outline"
            disabled={isFoundItemPending}
            className="w-full rounded-md"
          >
            <Archive className="h-4 w-4" aria-hidden="true" />
            {isFoundItemPending ? "Menyimpan..." : "Simpan barang temuan"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
