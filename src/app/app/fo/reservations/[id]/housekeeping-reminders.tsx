"use client";

import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { consoleButtonClassName } from "@/components/console-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  addReservationAddOn,
  removeReservationAddOn,
  updateHousekeepingNote,
} from "./actions";

type AddOn = {
  id: number;
  label: string;
  delivered: boolean;
};

export function HousekeepingReminders({
  reservationId,
  housekeepingNote,
  addOns,
}: {
  reservationId: number;
  housekeepingNote: string;
  addOns: AddOn[];
}) {
  const router = useRouter();
  const [note, setNote] = useState(housekeepingNote);
  const [newLabel, setNewLabel] = useState("");
  const [isSavingNote, startSaveNote] = useTransition();
  const [isAdding, startAdd] = useTransition();
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [isRemoving, startRemove] = useTransition();

  const noteChanged = note !== housekeepingNote;

  function handleSaveNote() {
    startSaveNote(async () => {
      const result = await updateHousekeepingNote(reservationId, note);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Catatan housekeeping disimpan");
      router.refresh();
    });
  }

  function handleAddAddOn() {
    const label = newLabel.trim();

    if (label.length === 0) {
      toast.error("Label tidak boleh kosong");
      return;
    }

    startAdd(async () => {
      const result = await addReservationAddOn(reservationId, label);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(`Add-on "${label}" ditambahkan`);
      setNewLabel("");
      router.refresh();
    });
  }

  function handleRemoveAddOn(addOn: AddOn) {
    setRemovingId(addOn.id);
    startRemove(async () => {
      const result = await removeReservationAddOn(addOn.id);

      if (!result.ok) {
        toast.error(result.error);
        setRemovingId(null);
        return;
      }

      toast.success(`Add-on "${addOn.label}" dihapus`);
      setRemovingId(null);
      router.refresh();
    });
  }

  return (
    <section className="border border-console-border bg-console-surface">
      <div className="border-b border-console-border bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
        {"// Housekeeping reminders"}
      </div>

      <div className="space-y-5 p-3.5">
        <div className="space-y-2">
          <label
            htmlFor={`hk-note-${reservationId}`}
            className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500"
          >
            Catatan housekeeping
          </label>
          <Textarea
            id={`hk-note-${reservationId}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={1000}
            placeholder="Mis. tamu alergi bulu, siapkan extra towel..."
            className="min-h-20 rounded-none border-slate-400 bg-console-bg text-[12px] text-console-ink placeholder:text-slate-400 focus-visible:border-console-ink focus-visible:ring-0"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveNote}
              disabled={isSavingNote || !noteChanged}
              className={consoleButtonClassName("primary")}
            >
              {isSavingNote ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Save aria-hidden="true" />
              )}
              {isSavingNote ? "Menyimpan..." : "Simpan Catatan"}
            </button>
          </div>
        </div>

        <div className="space-y-2 border-t border-console-border-soft pt-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            Add-ons
          </div>

          {addOns.length === 0 ? (
            <p className="text-[11px] italic text-slate-400">
              Belum ada add-on.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {addOns.map((addOn) => {
                const busy = isRemoving && removingId === addOn.id;

                return (
                  <li
                    key={addOn.id}
                    className="flex items-center justify-between gap-3 border border-console-border-soft bg-console-bg px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12px] font-semibold text-console-ink">
                        {addOn.label}
                      </span>
                      <span
                        className={[
                          "inline-flex items-center border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]",
                          addOn.delivered
                            ? "border-status-vc-pip bg-status-vc-bg text-status-vc-fg"
                            : "border-status-vd-pip bg-status-vd-bg text-status-vd-fg",
                        ].join(" ")}
                      >
                        {addOn.delivered ? "Diantar" : "Belum diantar"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAddOn(addOn)}
                      disabled={busy}
                      aria-label={`Hapus add-on ${addOn.label}`}
                      className={consoleButtonClassName("danger")}
                    >
                      {busy ? (
                        <Loader2 className="animate-spin" aria-hidden="true" />
                      ) : (
                        <Trash2 aria-hidden="true" />
                      )}
                      Hapus
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center">
            <Input
              value={newLabel}
              onChange={(event) => setNewLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleAddAddOn();
                }
              }}
              maxLength={100}
              placeholder="Label add-on, mis. Extra bed"
              className="h-9 rounded-none border-slate-400 bg-console-bg text-[12px] text-console-ink placeholder:text-slate-400 focus-visible:border-console-ink focus-visible:ring-0"
            />
            <button
              type="button"
              onClick={handleAddAddOn}
              disabled={isAdding || newLabel.trim().length === 0}
              className={consoleButtonClassName("secondary", "shrink-0")}
            >
              {isAdding ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Plus aria-hidden="true" />
              )}
              {isAdding ? "Menambahkan..." : "Tambah Add-on"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
