"use client";

import { Archive, Check, Play, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
};

function CardHeader({ children }: { children: string }) {
  return (
    <div className="bg-console-ink px-3.5 py-3">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
        {children}
      </h2>
    </div>
  );
}

export function HousekeeperWorkPanel({
  roomId,
  roomNumber,
  canStart,
  canFinish,
  activeCleaningSession,
  latestCompletedCleaningSession,
  workContext,
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
    <section className="border border-console-border bg-console-surface">
      <CardHeader>{"Tugas Housekeeper"}</CardHeader>
      <div className="space-y-3.5 p-3.5">
        {workContext ? (
          <div className="border border-console-border-soft bg-console-bg p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              {workContext.label}
            </div>
            <div className="mt-1 text-[12px] font-semibold text-console-ink">
              {workContext.guestName}
              {workContext.detail ? (
                <span className="num font-normal text-slate-500">
                  {" "}
                  · {workContext.detail}
                </span>
              ) : null}
            </div>
            {workContext.notes ? (
              <p className="mt-2 border-l-2 border-status-vcu-pip bg-status-vcu-bg px-3 py-2 text-[12px] leading-5 text-console-ink">
                {workContext.notes}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="border border-console-border-soft bg-console-bg px-3 py-2 text-[12px] text-slate-600">
            Tidak ada catatan reservasi aktif untuk kamar ini.
          </p>
        )}

        {activeCleaningSession ? (
          <div className="space-y-4 border border-console-border-soft bg-console-bg p-3">
            <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-500 text-center">
              Berlangsung · dimulai {formatTimeID(activeCleaningSession.startedAt)}
            </div>
            <div className="text-center">
              <CleaningTimer startedAt={activeCleaningSession.startedAt} />
            </div>
            {canFinish ? (
              <div className="space-y-3.5 border-t border-console-border-soft pt-3.5 text-left">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Checklist Amenities
                </div>
                
                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 text-[12px] font-semibold text-console-ink cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={linenChanged}
                      onChange={(e) => setLinenChanged(e.target.checked)}
                      className="h-4.5 w-4.5 rounded-none border border-slate-400 bg-console-bg text-console-ink focus:ring-0 focus:ring-offset-0 cursor-pointer accent-console-accent"
                    />
                    <span>Linen diganti (Ganti Sprei)</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-[12px] font-semibold text-console-ink cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={towelChanged}
                      onChange={(e) => setTowelChanged(e.target.checked)}
                      className="h-4.5 w-4.5 rounded-none border border-slate-400 bg-console-bg text-console-ink focus:ring-0 focus:ring-offset-0 cursor-pointer accent-console-accent"
                    />
                    <span>Handuk diganti</span>
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                    Catatan Pembersihan (Opsional)
                  </label>
                  <Textarea
                    placeholder="Catatan tambahan kondisi kamar..."
                    value={cleaningNote}
                    onChange={(e) => setCleaningNote(e.target.value)}
                    maxLength={500}
                    className="min-h-14 rounded-none border-slate-400 bg-console-bg text-[12px] text-console-ink placeholder:text-slate-400 focus-visible:border-console-ink focus-visible:ring-0"
                  />
                </div>

                <Button
                  type="button"
                  disabled={isPending}
                  onClick={handleFinishCleaning}
                  className="h-11 w-full rounded-none border-console-ink bg-console-ink text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
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
            disabled={isPending}
            onClick={() => runRoomAction(startCleaning, "Pembersihan dimulai")}
            className="h-11 w-full rounded-none border-console-accent bg-console-accent text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:bg-console-accent/90"
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            {isPending ? "Memulai..." : "Mulai Bersihkan"}
          </Button>
        ) : null}

        {!activeCleaningSession && !canStart ? (
          <div className="flex items-center gap-2 border border-console-border-soft bg-console-bg px-3 py-2 text-[12px] text-slate-600">
            <Check className="h-4 w-4 text-status-vc-fg" aria-hidden="true" />
            {latestCompletedCleaningSession
              ? `Selesai ${formatTimeID(latestCompletedCleaningSession.finishedAt)}`
              : "Tidak ada aksi pembersihan yang tersedia untuk status kamar ini."}
          </div>
        ) : null}

        <form
          ref={foundItemFormRef}
          onSubmit={submitFoundItem}
          className="space-y-2 border-t border-console-border-soft pt-3"
        >
          <input type="hidden" name="roomId" value={roomId} />
          <label
            htmlFor={`found-item-${roomId}`}
            className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500"
          >
            <Archive className="h-4 w-4" aria-hidden="true" />
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
            className="min-h-16 rounded-none border-slate-400 bg-console-bg text-[12px] text-console-ink placeholder:text-slate-400 focus-visible:border-console-ink focus-visible:ring-0"
          />
          {foundItemError ? (
            <p className="border border-red-500 bg-status-od-bg px-3 py-2 text-[12px] text-status-od-fg">
              {foundItemError}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={isFoundItemPending}
            className="h-9 w-full rounded-none border-console-ink bg-console-ink text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
          >
            <Archive className="h-4 w-4" aria-hidden="true" />
            {isFoundItemPending ? "Menyimpan..." : "Simpan barang temuan"}
          </Button>
        </form>
      </div>
    </section>
  );
}
