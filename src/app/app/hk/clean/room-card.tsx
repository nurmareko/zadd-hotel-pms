"use client";

import { Archive, Check, Play, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatTimeID } from "@/lib/format";
import type { CleanRoom } from "@/lib/housekeeper-clean-data";

import { CleaningTimer } from "../rooms/[roomId]/cleaning-timer";
import {
  finishCleaning,
  logFoundItemFromCleanCard,
  startCleaning,
} from "./actions";

const statusBadgeClass: Record<CleanRoom["status"], string> = {
  VC: "border-status-vc-pip bg-status-vc-bg text-status-vc-fg",
  OC: "border-status-oc-pip bg-status-oc-bg text-status-oc-fg",
  VD: "border-status-vd-pip bg-status-vd-bg text-status-vd-fg",
  OD: "border-status-od-pip bg-status-od-bg text-status-od-fg",
  VCU: "border-status-vcu-pip bg-status-vcu-bg text-status-vcu-fg",
  OOO: "border-status-ooo-pip bg-status-ooo-bg text-status-ooo-fg",
};

function FoundItemForm({ room }: { room: CleanRoom }) {
  return (
    <form
      action={logFoundItemFromCleanCard}
      className="space-y-2 border-t border-console-border-soft pt-3"
    >
      <input type="hidden" name="roomId" value={room.id} />
      <label
        htmlFor={`found-item-${room.id}`}
        className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500"
      >
        <Archive className="h-4 w-4" aria-hidden="true" />
        Log found item
      </label>
      <Textarea
        id={`found-item-${room.id}`}
        name="description"
        required
        minLength={3}
        maxLength={500}
        placeholder={`Room ${room.number} item description`}
        className="min-h-16 rounded-none border-slate-400 bg-console-bg text-[12px] text-console-ink placeholder:text-slate-400 focus-visible:border-console-ink focus-visible:ring-0"
      />
      <button
        type="submit"
        className="inline-flex h-9 w-full items-center justify-center gap-1.5 border border-console-ink bg-console-ink text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
      >
        <Archive className="h-4 w-4" aria-hidden="true" />
        Save found item
      </button>
    </form>
  );
}

export function RoomCard({ room }: { room: CleanRoom }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function runRoomAction(
    action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>,
    successMessage: string,
  ) {
    const formData = new FormData();
    formData.set("roomId", String(room.id));

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

  const isCompleted =
    room.group === "done" && !room.inProgress && room.finishedAt !== null;

  return (
    <article className="border border-console-border bg-console-surface">
      <div className="flex items-start justify-between gap-3 border-b border-console-border-soft px-3.5 py-3">
        <div>
          <div className="num text-[22px] font-bold leading-none text-console-ink">
            {room.number}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {room.typeCode} · {room.typeName}
          </div>
        </div>
        {room.inProgress ? (
          <StatusBadge
            label="In Progress"
            className="border-console-ink bg-console-ink text-console-accent"
            pipClassName="bg-console-accent"
            size="md"
          />
        ) : (
          <StatusBadge
            label={room.status}
            className={statusBadgeClass[room.status]}
            size="md"
          />
        )}
      </div>

      <div className="space-y-3 px-3.5 py-3">
        {room.context ? (
          <div className="text-[12px] leading-5 text-slate-600">
            {room.context.kind === "turnover" ? (
              <>
                <span className="font-semibold text-console-ink">
                  Kedatangan berikutnya:
                </span>{" "}
                {room.context.guestName}
                {room.context.etaLabel ? (
                  <span className="num"> · ETA {room.context.etaLabel}</span>
                ) : null}
              </>
            ) : (
              <>
                <span className="font-semibold text-console-ink">Tamu:</span>{" "}
                {room.context.guestName}
                <span className="num"> · {room.context.nightsLabel}</span>
              </>
            )}
          </div>
        ) : null}

        {room.notes ? (
          <div className="border-l-2 border-status-vcu-pip bg-status-vcu-bg px-3 py-2">
            <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-status-vcu-fg">
              Catatan
            </div>
            <div className="mt-0.5 text-[12px] leading-5 text-console-ink">
              {room.notes}
            </div>
          </div>
        ) : null}

        {room.inProgress && room.startedAt ? (
          <div className="space-y-3 border-t border-console-border-soft pt-3">
            <div className="border border-console-border-soft bg-console-bg p-3 text-center">
              <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Berlangsung · dimulai {formatTimeID(room.startedAt)}
              </div>
              <div className="mt-1.5">
                <CleaningTimer startedAt={room.startedAt} />
              </div>
            </div>
            <Button
              type="button"
              disabled={isPending}
              onClick={() =>
                runRoomAction(finishCleaning, "Pembersihan selesai")
              }
              className="h-11 w-full rounded-none border-console-ink bg-console-ink text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
            >
              <Square className="h-4 w-4" aria-hidden="true" />
              {isPending ? "Menyelesaikan..." : "Selesai Bersihkan"}
            </Button>
          </div>
        ) : null}

        {!room.inProgress && room.group !== "done" ? (
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

        <FoundItemForm room={room} />

        {isCompleted ? (
          <div className="flex items-center gap-2 border-t border-console-border-soft pt-3 text-[12px] text-slate-600">
            <Check className="h-4 w-4 text-status-vc-fg" aria-hidden="true" />
            Selesai {formatTimeID(room.finishedAt as Date)} · status {room.status}
          </div>
        ) : null}
      </div>
    </article>
  );
}
