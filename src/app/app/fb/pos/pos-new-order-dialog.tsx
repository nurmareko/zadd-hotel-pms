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
        toast.error("The order could not be created. Check the order list before trying again.");
      } finally {
        busy.current = false;
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy.current) onClose(); }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>New Order</DialogTitle>
          <DialogDescription>{roomService ? "Room Service — for in-house guests." : "Dine-in — select a table and number of guests."}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); submit(); }} aria-busy={isPending}>
          <fieldset disabled={isPending} className="space-y-4">
            {roomService ? (
              <div className="space-y-2"><label htmlFor="pos-room">Room number</label><Input id="pos-room" className="h-11" required maxLength={10} value={roomNumber} onChange={(event) => setRoomNumber(event.target.value)} /></div>
            ) : (
              <div className="space-y-2">
                <label htmlFor="pos-table">Table</label>
                <select id="pos-table" required className="h-11 w-full rounded-md border bg-white px-3" value={tableId} onChange={(event) => setTableId(event.target.value)}>
                  <option value="">Select a table</option>
                  {availableTables.map((item) => <option key={item.id} value={item.id}>Table {item.number} · {item.capacity} guests{item.status === "RESERVED" ? " · Reserved" : ""}</option>)}
                </select>
                {availableTables.length === 0 && <p role="status" className="text-muted-foreground">No tables are available. Select an active order.</p>}
              </div>
            )}
            <div className="space-y-2"><label htmlFor="pos-guests">Number of guests</label><Input id="pos-guests" className="h-11" required type="number" inputMode="numeric" min={1} max={roomService ? 99 : Math.min(selectedTable?.capacity ?? 99, 99)} step={1} value={guestCount} onChange={(event) => setGuestCount(event.target.value)} /></div>
          </fieldset>
          <DialogFooter>
            <Button type="button" className="min-h-11" variant="outline" disabled={isPending} onClick={onClose}>Cancel</Button>
            <Button type="submit" className="min-h-11" disabled={isPending || (!roomService && !selectedTable)}>{isPending ? "Creating order..." : "Create Order"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
