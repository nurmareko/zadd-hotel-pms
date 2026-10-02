"use client";

import { PaymentMethod, Prisma } from "@prisma/client";
import { useId, useRef, useState } from "react";

import {
  chargeOrderToRoom,
  payOrderDirect,
  type PaymentActionResult,
} from "@/app/app/fb/orders/[orderId]/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { fbOrderGuestLabel } from "@/lib/fb-order-guest";
import { computeFBOrderTotals } from "@/lib/fb-order-totals";
import {
  lookupRoomForCharge,
  type ChargeLookupResult,
} from "@/lib/fb-orders/actions";
import { formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { PosOrder, PosSettings } from "./pos-types";

type PaymentSuccess = Extract<PaymentActionResult, { ok: true }>;
type ConfirmedRoom = Extract<ChargeLookupResult, { ok: true }>;

const methods = [
  { value: PaymentMethod.CASH, label: "Tunai" },
  { value: PaymentMethod.CARD, label: "Kartu" },
  { value: PaymentMethod.TRANSFER, label: "Transfer" },
  { value: PaymentMethod.CHARGE_TO_ROOM, label: "Bebankan ke kamar" },
] as const;

// Mount only while open, with a fresh BILLED order after confirmBill succeeds.
export function PosPaymentDialog({
  order,
  settings,
  split,
  onClose,
  onSettled,
}: {
  order: PosOrder;
  settings: PosSettings;
  split: boolean;
  onClose: () => void;
  onSettled: () => void;
}) {
  const id = useId();
  const busy = useRef(false);
  const settled = useRef(false);
  const settlementUncertain = useRef(false);
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);
  const [pending, setPending] = useState(false);
  const [quantities, setQuantities] = useState<Record<number, number>>(() =>
    Object.fromEntries(order.items.map((item) => [item.id, split ? 0 : item.quantity])),
  );
  const isRoomService = order.serviceType === "ROOM_SERVICE";
  const [method, setMethod] = useState<PaymentMethod>(
    isRoomService ? PaymentMethod.CHARGE_TO_ROOM : PaymentMethod.CASH,
  );
  const [amountTendered, setAmountTendered] = useState("");
  const [reference, setReference] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [room, setRoom] = useState<ConfirmedRoom | null>(null);
  const [roomConfirmed, setRoomConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<PaymentSuccess | null>(null);

  const lines = order.items.map((item) => {
    const quantity = split
      ? Math.min(item.quantity, quantities[item.id] ?? 0)
      : item.quantity;
    return {
      ...item,
      selectedQuantity: quantity,
      selectedAmount: new Prisma.Decimal(item.unitPrice).mul(quantity),
    };
  });
  const selectedItems = lines
    .filter((item) => item.selectedQuantity > 0)
    .map((item) => ({ orderItemId: item.id, quantity: item.selectedQuantity }));
  const totals = computeFBOrderTotals(
    lines.map((item) => ({ amount: item.selectedAmount })),
    {
      serviceChargePercent: new Prisma.Decimal(settings.serviceChargePercent),
      taxPercent: new Prisma.Decimal(settings.taxPercent),
    },
  );
  // The action's transport schema coerces cash to a JS number; reject unsafe integers.
  const tendered = /^\d+$/.test(amountTendered)
    ? new Prisma.Decimal(amountTendered)
    : null;
  const cashValid = tendered !== null && tendered.lte(Number.MAX_SAFE_INTEGER)
    && tendered.gt(0) && tendered.gte(totals.total);
  const chargeReady = isRoomService
    ? Boolean(order.attachedRoomFolio)
    : room !== null && room.roomNumber === roomNumber.trim() && roomConfirmed;
  const canSubmit = !outcomeUnknown && order.status === "BILLED" && selectedItems.length > 0
    && totals.total.gt(0)
    && (method !== PaymentMethod.CASH || cashValid)
    && (method !== PaymentMethod.CHARGE_TO_ROOM || chargeReady);

  function close() {
    if (!busy.current) onClose();
  }

  async function lookupRoom() {
    if (busy.current || settled.current || settlementUncertain.current || !roomNumber.trim()) return;
    busy.current = true;
    setPending(true);
    setError(null);
    setRoom(null);
    setRoomConfirmed(false);
    try {
      const result = await lookupRoomForCharge({ roomNumber: roomNumber.trim() });
      if (result.ok) setRoom(result);
      else setError(result.error);
    } catch {
      setError("Pencarian kamar gagal. Silakan coba lagi.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  async function settle() {
    if (busy.current || settled.current || settlementUncertain.current || !canSubmit) return;
    busy.current = true;
    setPending(true);
    setError(null);
    let completed = false;
    try {
      // Selection and terminal payment remain one canonical backend transaction.
      const result = method === PaymentMethod.CHARGE_TO_ROOM
        ? await chargeOrderToRoom({
            orderId: order.id,
            selectedItems,
            roomNumber: isRoomService ? undefined : room!.roomNumber,
          })
        : await payOrderDirect({
            orderId: order.id,
            method,
            selectedItems,
            amountTendered: method === PaymentMethod.CASH ? tendered!.toFixed(0) : undefined,
            reference: method === PaymentMethod.CASH ? undefined : reference.trim(),
          });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      settled.current = true;
      setSuccess(result);
      completed = true;
    } catch {
      // A lost response can follow a committed split; never retry this snapshot.
      settlementUncertain.current = true;
      setOutcomeUnknown(true);
    } finally {
      busy.current = false;
      setPending(false);
    }
    // Refresh failures must not turn a committed payment into a retryable failure.
    if (completed) onSettled();
  }

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent showCloseButton={false} className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{success ? "Hasil pembayaran" : split ? "Pisah pembayaran" : "Pembayaran pesanan"}</DialogTitle>
          <DialogDescription>{order.orderNo} · {order.destination}</DialogDescription>
        </DialogHeader>

        {success ? (
          <>
            <div role="status" className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <p className="font-semibold">
                {success.alreadyClosed ? "Pesanan sudah ditutup. Tidak ada pembayaran baru."
                  : success.paymentMethod === PaymentMethod.CHARGE_TO_ROOM
                    ? "Tagihan berhasil dibebankan ke folio."
                    : "Pembayaran berhasil dicatat."}
              </p>
              <dl className="space-y-2">
                <div className="flex justify-between gap-4"><dt>Metode</dt><dd>{methods.find((option) => option.value === success.paymentMethod)?.label}</dd></div>
                {!success.alreadyClosed && (
                  <div className="flex justify-between gap-4 font-semibold"><dt>Total diproses</dt><dd>{formatIDR(success.paidTotal)}</dd></div>
                )}
                {success.amountTendered !== undefined && (
                  <div className="flex justify-between gap-4"><dt>Uang diterima</dt><dd>{formatIDR(success.amountTendered)}</dd></div>
                )}
                {success.change !== undefined && (
                  <div className="flex justify-between gap-4"><dt>Kembalian</dt><dd>{formatIDR(success.change)}</dd></div>
                )}
                {success.folioNo && <div className="flex justify-between gap-4"><dt>Folio</dt><dd>{success.folioNo}</dd></div>}
              </dl>
              {success.fullyPaid === false && <p>Sisa item belum dibayar. Tutup dialog untuk melanjutkan pembayaran berikutnya.</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className="min-h-11" onClick={close}>Tutup</Button>
              <a className={buttonVariants({ className: "min-h-11" })} href={`/api/fb-orders/${success.receiptOrderId}/receipt`} target="_blank" rel="noopener noreferrer">Lihat struk</a>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); void settle(); }} className="space-y-4" aria-busy={pending}>
            {order.status !== "BILLED" && <p role="alert" className="text-destructive">Tagihan pesanan harus dikonfirmasi sebelum membuka pembayaran.</p>}
            <fieldset disabled={pending || outcomeUnknown || order.status !== "BILLED"} className="min-w-0 space-y-4">
              <legend className="mb-2 font-semibold">{split ? "Pilih jumlah item yang dibayar" : "Item yang dibayar"}</legend>
              <ul className="divide-y rounded-lg border px-3">
                {lines.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1 basis-40 break-words">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{fbOrderGuestLabel(item.guestNumber)} · {formatIDR(item.unitPrice)} / item</p>
                      {item.notes && <p className="text-sm text-muted-foreground">{item.notes}</p>}
                      <p className="mt-1 tabular-nums">{formatIDR(item.selectedAmount.toFixed(0, Prisma.Decimal.ROUND_HALF_UP))}</p>
                    </div>
                    {split ? (
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" className="size-11" aria-label={`Kurangi ${item.name}, ${fbOrderGuestLabel(item.guestNumber)}`} disabled={item.selectedQuantity === 0} onClick={() => setQuantities((current) => ({ ...current, [item.id]: item.selectedQuantity - 1 }))}>−</Button>
                        <Input type="number" inputMode="numeric" min={0} max={item.quantity} step={1} className="h-11 w-16 text-center" aria-label={`Jumlah ${item.name}, ${fbOrderGuestLabel(item.guestNumber)}, maksimal ${item.quantity}`} value={item.selectedQuantity} onChange={(event) => {
                          const value = Number(event.target.value);
                          if (Number.isInteger(value) && value >= 0 && value <= item.quantity) setQuantities((current) => ({ ...current, [item.id]: value }));
                        }} />
                        <Button type="button" variant="outline" className="size-11" aria-label={`Tambah ${item.name}, ${fbOrderGuestLabel(item.guestNumber)}`} disabled={item.selectedQuantity === item.quantity} onClick={() => setQuantities((current) => ({ ...current, [item.id]: item.selectedQuantity + 1 }))}>+</Button>
                        <span className="text-muted-foreground">/ {item.quantity}</span>
                      </div>
                    ) : <span>{item.quantity} item</span>}
                  </li>
                ))}
              </ul>
              {selectedItems.length === 0 && <p role="status" className="text-muted-foreground">Pilih minimal satu item untuk dibayar.</p>}
              <dl className="space-y-2 rounded-lg bg-muted/30 p-4 tabular-nums" aria-live="polite">
                {[
                  ["Subtotal", totals.subtotal],
                  [`Biaya layanan (${settings.serviceChargePercent}%)`, totals.serviceCharge],
                  [`Pajak (${settings.taxPercent}%)`, totals.tax],
                  ["Total pembayaran", totals.total],
                ].map(([label, amount]) => (
                  <div key={String(label)} className="flex justify-between gap-4 last:border-t last:pt-2 last:font-semibold"><dt>{String(label)}</dt><dd>{formatIDR((amount as Prisma.Decimal).toFixed(0))}</dd></div>
                ))}
              </dl>
              <fieldset>
                <legend className="mb-2 font-semibold">Metode pembayaran</legend>
                <div className="grid grid-cols-2 gap-2">
                  {methods.map((option) => (
                    <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border p-3 has-checked:border-primary has-checked:bg-primary/5">
                      <input type="radio" name={`${id}-method`} value={option.value} checked={method === option.value} onChange={() => { setMethod(option.value); setError(null); }} />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              {method === PaymentMethod.CASH && (
                <div className="space-y-2">
                  <label htmlFor={`${id}-cash`}>Uang diterima (rupiah penuh)</label>
                  <Input id={`${id}-cash`} className="h-11" inputMode="numeric" value={amountTendered} maxLength={16} onChange={(event) => setAmountTendered(event.target.value)} aria-describedby={`${id}-cash-help`} />
                  <p id={`${id}-cash-help`} className="text-muted-foreground">
                    {cashValid ? `Kembalian: ${formatIDR(tendered!.minus(totals.total).toFixed(0))}` : "Masukkan rupiah penuh tanpa pemisah, minimal sebesar total pembayaran."}
                  </p>
                </div>
              )}
              {(method === PaymentMethod.CARD || method === PaymentMethod.TRANSFER) && (
                <div className="space-y-2">
                  <label htmlFor={`${id}-reference`}>Referensi pembayaran (opsional)</label>
                  <Input id={`${id}-reference`} className="h-11" maxLength={100} value={reference} onChange={(event) => setReference(event.target.value)} />
                </div>
              )}
              {method === PaymentMethod.CHARGE_TO_ROOM && (
                isRoomService ? (
                  <div className="rounded-lg border p-3">
                    <p className="font-semibold">Folio layanan kamar</p>
                    {order.attachedRoomFolio ? <p>{order.attachedRoomFolio.guestName} · Kamar {order.attachedRoomFolio.roomNumber} · {order.attachedRoomFolio.folioNo}</p> : <p role="alert">Pesanan layanan kamar belum terhubung ke folio kamar.</p>}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label htmlFor={`${id}-room`}>Nomor kamar</label>
                    <div className="flex gap-2">
                      <Input id={`${id}-room`} className="h-11" maxLength={10} value={roomNumber} onChange={(event) => { setRoomNumber(event.target.value); setRoom(null); setRoomConfirmed(false); setError(null); }} />
                      <Button type="button" variant="outline" className="min-h-11" disabled={!roomNumber.trim()} onClick={() => void lookupRoom()}>Cari kamar</Button>
                    </div>
                    {room && (
                      <div className="rounded-lg border p-3">
                        <p role="status">{room.guestName} · Kamar {room.roomNumber} · {room.folioNo}</p>
                        <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-3">
                          <input type="checkbox" checked={roomConfirmed} onChange={(event) => setRoomConfirmed(event.target.checked)} />
                          Saya mengonfirmasi tamu dan folio tujuan ini.
                        </label>
                      </div>
                    )}
                  </div>
                )
              )}
            </fieldset>
            {outcomeUnknown ? (
              <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 p-3 text-destructive">
                <p className="font-semibold">Hasil pembayaran belum diketahui.</p>
                <p>Pembayaran mungkin sudah tercatat meskipun konfirmasi tidak diterima. Pengubahan dan pembayaran ulang dinonaktifkan untuk dialog ini agar tidak terjadi pembayaran ganda.</p>
                <p>Periksa pembayaran sebelumnya pada detail pesanan sebelum memulai lagi. Pilih Tutup & Muat Ulang untuk memperbarui data pesanan.</p>
              </div>
            ) : error && (
              <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 p-3 text-destructive">
                <p>{error}</p>
                <p>Perbaiki isian jika diperlukan. Jika status atau jumlah item pesanan berubah, pilih Tutup & Muat Ulang sebelum melanjutkan.</p>
              </div>
            )}
            {(outcomeUnknown || error) && (
              <a className={cn(buttonVariants({ variant: "outline" }), "min-h-11 h-auto max-w-full whitespace-normal text-center")} href={`/app/fb/orders/${order.id}/payment`} target="_blank" rel="noopener noreferrer">Periksa detail pesanan dan pembayaran</a>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={close}>{outcomeUnknown || error ? "Tutup & Muat Ulang" : "Batal"}</Button>
              <Button type="submit" className="min-h-11" disabled={pending || !canSubmit}>{pending ? "Memproses…" : method === PaymentMethod.CHARGE_TO_ROOM ? "Bebankan ke folio" : "Konfirmasi pembayaran"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
