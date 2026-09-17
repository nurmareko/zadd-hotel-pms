"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { HousekeeperMobileData } from "@/lib/housekeeper-mobile-data";
import { reportFloorLostFound } from "./actions";
import { useMobileAction } from "./mobile-presentation";

export type QuickLostFoundDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: HousekeeperMobileData["allHotelRooms"];
  defaultRoomId?: number;
};

export function QuickLostFoundDialog({ open, onOpenChange, rooms, defaultRoomId }: QuickLostFoundDialogProps) {
  const { isPending, run } = useMobileAction();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const description = String(formData.get("description") ?? "").trim();
    if (description.length < 3) {
      toast.error("Deskripsi barang temuan minimal 3 karakter");
      return;
    }
    formData.set("description", description);
    if (!formData.get("roomId")) formData.delete("roomId");
    run(() => reportFloorLostFound(formData), "Barang temuan berhasil dilaporkan", () => onOpenChange(false));
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!isPending) onOpenChange(nextOpen); }}>
      <DialogContent showCloseButton={false} className="max-h-[85dvh] min-w-0 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lapor Temuan</DialogTitle>
          <DialogDescription>Pilih kamar atau area umum, lalu jelaskan barang dan lokasi penemuannya.</DialogDescription>
        </DialogHeader>
        {open ? (
          <form onSubmit={submit} aria-busy={isPending} className="min-w-0 space-y-4">
            <fieldset disabled={isPending} className="relative min-w-0 space-y-4">
              <legend className="sr-only">Detail barang temuan</legend>
              <label className="block min-w-0 space-y-2 text-sm font-medium">
                <span>Lokasi temuan</span>
                <select name="roomId" defaultValue={defaultRoomId ?? ""} className="min-h-12 w-full min-w-0 max-w-full rounded-md border border-slate-300 bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900">
                  <option value="">Area Publik / Koridor</option>
                  {rooms.map((room) => <option key={room.id} value={room.id}>Kamar {room.number}</option>)}
                </select>
              </label>
              <FoundDescription />
            </fieldset>
            <div className="grid grid-cols-1 gap-2">
              <Button type="submit" disabled={isPending} className="min-h-12 w-full">
                {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}Simpan temuan
              </Button>
              <Button type="button" variant="outline" disabled={isPending} onClick={() => onOpenChange(false)} className="min-h-12 w-full">Batal</Button>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function FoundDescription() {
  const [description, setDescription] = useState("");
  return (
    <label className="block space-y-2 text-sm font-medium">
      <span>Deskripsi barang dan lokasi *</span>
      <Textarea name="description" required minLength={3} maxLength={500} value={description} onChange={(event) => {
        const value = event.target.value;
        setDescription(value);
        event.target.setCustomValidity(value.trim() ? "" : "Deskripsi barang temuan wajib diisi");
      }} placeholder="Contoh: Jam tangan hitam ditemukan di meja dekat lift lantai 2" className="min-h-28 w-full min-w-0 text-base" />
    </label>
  );
}
