"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createRoomBlockAction, releaseRoomBlockAction } from "@/lib/room-blocks/actions";
import type { RoomBlockActionResult } from "@/lib/room-blocks/errors";
import { ROOM_BLOCK_REASON_LABELS } from "@/lib/room-blocks/overlap";
import { CreateRoomBlockSchema, type CreateRoomBlockInput } from "@/lib/room-blocks/schema";

const controlClass = "h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus-visible:border-slate-500 focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-60 desktop:h-10";
type Failure = Extract<RoomBlockActionResult, { ok: false }>;
export type RoomOption = { id: number; number: string; roomType: { name: string } };

export function CreateBlockDialog({ rooms, today, tomorrow }: { rooms: RoomOption[]; today: string; tomorrow: string }) {
  const [open, setOpen] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  function showFailure(result: Failure) {
    setFailure(result);
    if (result.field) {
      const field = formRef.current?.elements.namedItem(result.field);
      if (field instanceof HTMLElement) field.focus();
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = CreateRoomBlockSchema.safeParse(data);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = String(issue.path[0] ?? "");
      showFailure({ ok: false, code: "INVALID_INPUT", field, error: field === "roomId" ? "Pilih kamar yang valid." : field === "reason" ? "Pilih alasan blokir kamar yang valid." : issue.message });
      return;
    }
    const input: CreateRoomBlockInput = parsed.data;
    submitting.current = true;
    setFailure(null);
    startTransition(async () => {
      try {
        const result = await createRoomBlockAction(input);
        if (!result.ok) return showFailure(result);
        toast.success("Blokir kamar berhasil dibuat.");
        setOpen(false);
        router.refresh();
      } catch {
        setFailure({ ok: false, code: "UNEXPECTED", error: "Hasil penyimpanan belum dapat dikonfirmasi. Periksa daftar blokir sebelum mencoba lagi." });
      } finally {
        submitting.current = false;
      }
    });
  }

  const invalid = (field: string) => ({ "aria-invalid": failure?.field === field || undefined, "aria-describedby": failure?.field === field ? "create-block-error" : undefined });
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!submitting.current) { setOpen(next); setFailure(null); } }}>
      <DialogTrigger render={<Button disabled={rooms.length === 0} />}><Plus aria-hidden="true" />Buat Blokir</DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Blokir Kamar</DialogTitle>
          <DialogDescription>Kamar tidak dapat digunakan untuk reservasi selama rentang blokir. Tanggal selesai tidak termasuk malam yang diblokir.</DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={submit} noValidate className="space-y-4" aria-busy={pending}>
          <fieldset disabled={pending} className="space-y-4">
            <div className="space-y-1.5"><label htmlFor="block-room" className="text-sm font-medium">Kamar</label>
              <select id="block-room" name="roomId" required defaultValue="" className={controlClass} {...invalid("roomId")}>
                <option value="" disabled>Pilih kamar</option>
                {rooms.map((room) => <option key={room.id} value={room.id}>{room.number} · {room.roomType.name}</option>)}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><label htmlFor="block-start" className="text-sm font-medium">Tanggal Mulai</label><input id="block-start" name="startDate" type="date" required defaultValue={today} className={controlClass} {...invalid("startDate")} /></div>
              <div className="space-y-1.5"><label htmlFor="block-end" className="text-sm font-medium">Tanggal Selesai</label><input id="block-end" name="endDate" type="date" required defaultValue={tomorrow} className={controlClass} {...invalid("endDate")} /></div>
            </div>
            <div className="space-y-1.5"><label htmlFor="block-reason" className="text-sm font-medium">Alasan</label>
              <select id="block-reason" name="reason" defaultValue="MAINTENANCE" className={controlClass} {...invalid("reason")}>
                {Object.entries(ROOM_BLOCK_REASON_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><label htmlFor="block-note" className="text-sm font-medium">Catatan <span className="font-normal text-slate-500">(opsional)</span></label>
              <textarea id="block-note" name="note" rows={3} maxLength={2000} className={`${controlClass} h-auto py-2 desktop:h-auto`} {...invalid("note")} aria-describedby={failure?.field === "note" ? "block-note-hint create-block-error" : "block-note-hint"} />
              <p id="block-note-hint" className="text-xs text-slate-500">Maksimal 2.000 karakter. Sertakan rincian pekerjaan bila diperlukan.</p>
            </div>
          </fieldset>
          {failure && <p id="create-block-error" role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{failure.error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" disabled={pending}>{pending ? "Menyimpan…" : "Simpan Blokir"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReleaseBlockDialog({ blockId, roomNumber, startDate, endDate }: { blockId: number; roomNumber: string; startDate: string; endDate: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);
  const router = useRouter();
  function release() {
    if (submitting.current) return;
    submitting.current = true;
    setError("");
    startTransition(async () => {
      try {
        const result = await releaseRoomBlockAction({ blockId });
        if (!result.ok) { setError(result.error); return; }
        toast.success(result.alreadyReleased ? "Blokir kamar sudah dilepas sebelumnya." : "Blokir kamar berhasil dilepas.");
        setOpen(false);
        router.refresh();
      } catch {
        setError("Hasil pelepasan belum dapat dikonfirmasi. Periksa daftar atau coba lagi.");
      } finally { submitting.current = false; }
    });
  }
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!submitting.current) { setOpen(next); setError(""); } }}>
      <DialogTrigger render={<Button variant="outline" size="sm" aria-label={`Lepas blokir kamar ${roomNumber}, ${startDate} hingga ${endDate}`} />}>Lepas Blokir</DialogTrigger>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Lepas Blokir Kamar {roomNumber}?</DialogTitle>
          <DialogDescription>Blokir tanggal {startDate} hingga sebelum {endDate} akan dilepas. Riwayat tetap tersimpan. Ketersediaan kamar tetap mengikuti reservasi dan blokir aktif lainnya.</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>Batal</Button>
          <Button disabled={pending} onClick={release}>{pending ? "Melepas…" : "Ya, Lepas Blokir"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
