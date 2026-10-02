"use client";

import type { FBOrderServiceType } from "@prisma/client";
import { unstable_rethrow } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createOrder, createRoomServiceOrder } from "@/lib/fb-orders/actions";

import type { PosTable } from "./pos-types";

export function PosNewOrderDialog({ serviceType, tables, table, onClose }: {
  serviceType: FBOrderServiceType;
  tables: PosTable[];
  table: PosTable | null;
  onClose: () => void;
}) {
  const [tableId, setTableId] = useState(table?.id.toString() ?? "");
  const [roomNumber, setRoomNumber] = useState("");
  const [guestCount, setGuestCount] = useState("1");
  const [isPending, startTransition] = useTransition();
  const busy = useRef(false);
  const availableTables = tables.filter((item) =>
    (item.status === "AVAILABLE" || item.status === "RESERVED") && item.orderIds.length === 0,
  );
  const selectedTable = availableTables.find((item) => item.id === Number(tableId));
  const roomService = serviceType === "ROOM_SERVICE";

  function submit() {
    if (busy.current) return;
    busy.current = true;
    startTransition(async () => {
      try {
        const result = roomService
          ? await createRoomServiceOrder({ roomNumber, guestCount }, "pos")
          : await createOrder({ tableId, guestCount }, "pos");
        if (!result.ok) toast.error(result.error);
      } catch (error) {
        unstable_rethrow(error);
        toast.error("Pesanan belum dapat dibuat. Periksa daftar pesanan sebelum mencoba lagi.");
      } finally {
        busy.current = false;
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy.current) onClose(); }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Pesanan Baru</DialogTitle>
          <DialogDescription>{roomService ? "Layanan Kamar — untuk tamu yang sedang menginap." : "Makan di Tempat — pilih meja dan jumlah tamu."}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); submit(); }} aria-busy={isPending}>
          <fieldset disabled={isPending} className="space-y-4">
            {roomService ? (
              <div className="space-y-2"><label htmlFor="pos-room">Nomor kamar</label><Input id="pos-room" className="h-11" required maxLength={10} value={roomNumber} onChange={(event) => setRoomNumber(event.target.value)} /></div>
            ) : (
              <div className="space-y-2">
                <label htmlFor="pos-table">Meja</label>
                <select id="pos-table" required className="h-11 w-full rounded-md border bg-white px-3" value={tableId} onChange={(event) => setTableId(event.target.value)}>
                  <option value="">Pilih meja</option>
                  {availableTables.map((item) => <option key={item.id} value={item.id}>Meja {item.number} · {item.capacity} tamu{item.status === "RESERVED" ? " · Dipesan" : ""}</option>)}
                </select>
                {availableTables.length === 0 && <p role="status" className="text-muted-foreground">Tidak ada meja tersedia. Pilih pesanan yang sedang berjalan.</p>}
              </div>
            )}
            <div className="space-y-2"><label htmlFor="pos-guests">Jumlah tamu</label><Input id="pos-guests" className="h-11" required type="number" inputMode="numeric" min={1} max={roomService ? 99 : Math.min(selectedTable?.capacity ?? 99, 99)} step={1} value={guestCount} onChange={(event) => setGuestCount(event.target.value)} /></div>
          </fieldset>
          <DialogFooter>
            <Button type="button" className="min-h-11" variant="outline" disabled={isPending} onClick={onClose}>Batal</Button>
            <Button type="submit" className="min-h-11" disabled={isPending || (!roomService && !selectedTable)}>{isPending ? "Membuat pesanan..." : "Buat Pesanan"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
