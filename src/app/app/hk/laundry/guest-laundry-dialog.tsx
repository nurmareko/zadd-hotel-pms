"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatDecimalID } from "@/lib/format";
import { createGuestLaundryOrder } from "@/lib/laundry/guest-actions";
import { GuestLaundryOrderSchema, calculateGuestLaundryTotal, type GuestLaundryOrderInput } from "@/lib/laundry/guest-schema";
import { controlClass } from "./laundry-labels";

type Props = {
  rooms: { id: number; number: string; guestName: string }[];
  catalog: { id: number; code: string; name: string; defaultPrice: number | null }[];
};
type ItemRow = { key: number; articleId: string; quantity: string; unitPrice: string };
const emptyRow = (key: number): ItemRow => ({ key, articleId: "", quantity: "1", unitPrice: "" });
const money = (amount: number) => `Rp ${formatDecimalID(amount)}`;

function previewTotal(items: { quantity: number; unitPrice: number }[]): number | null {
  try {
    return calculateGuestLaundryTotal(items);
  } catch {
    return null;
  }
}

export function GuestLaundryDialog({ rooms, catalog }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);
  const nextKey = useRef(1);
  const [rows, setRows] = useState<ItemRow[]>([emptyRow(0)]);
  const [settlement, setSettlement] = useState<GuestLaundryOrderInput["settlementType"]>("CHARGE_TO_ROOM");
  const [paymentMethod, setPaymentMethod] = useState<NonNullable<GuestLaundryOrderInput["paymentMethod"]>>("CASH");
  const [cashTendered, setCashTendered] = useState("");
  const [error, setError] = useState<string | null>(null);
  const directCash = settlement === "DIRECT_TENDER" && paymentMethod === "CASH";
  const items = rows.map((row) => ({ articleId: Number(row.articleId), quantity: Number(row.quantity), unitPrice: Number(row.unitPrice) }));
  const preview = previewTotal(items);
  const validAmounts = preview !== null;
  const total = preview ?? 0;
  const pieces = validAmounts ? items.reduce((sum, item) => sum + item.quantity, 0) : 0;
  const cash = Number(cashTendered);
  const insufficientCash = directCash && (cashTendered === "" || !Number.isFinite(cash) || cash < total);

  function reset() {
    setRows([emptyRow(0)]);
    nextKey.current = 1;
    setSettlement("CHARGE_TO_ROOM");
    setPaymentMethod("CASH");
    setCashTendered("");
    setError(null);
  }

  function updateRow(key: number, patch: Partial<ItemRow>) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row));
  }

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (submitting.current) return;
      if (next) reset();
      setOpen(next);
    }}>
      <DialogTrigger render={<Button className="min-h-11" disabled={rooms.length === 0 || catalog.length === 0} />}>
        <Plus className="size-4" aria-hidden="true" />Catat Laundry Tamu
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Catat Laundry Tamu</DialogTitle>
          <DialogDescription>Pilih kamar, rincian cucian, dan cara pembayaran. Periksa total sebelum menyimpan.</DialogDescription>
        </DialogHeader>
        <form className="min-w-0 space-y-4" aria-busy={pending} onSubmit={(event) => {
          event.preventDefault();
          if (submitting.current) return;
          const data = new FormData(event.currentTarget);
          setError(null);
          const parsed = GuestLaundryOrderSchema.safeParse({
            roomId: Number(data.get("roomId")), items, settlementType: settlement,
            paymentMethod: settlement === "DIRECT_TENDER" ? paymentMethod : undefined,
            cashTendered: directCash && cashTendered !== "" ? cash : undefined,
            notes: String(data.get("notes") ?? "").trim() || undefined,
          });
          if (!parsed.success || insufficientCash) {
            const message = insufficientCash ? "Uang diterima harus mencukupi total biaya laundry." : parsed.error?.issues[0]?.message ?? "Periksa kembali rincian laundry.";
            setError(message);
            toast.error(message);
            return;
          }
          const input: GuestLaundryOrderInput = parsed.data;
          submitting.current = true;
          startTransition(async () => {
            try {
              const result = await createGuestLaundryOrder(input);
              if (!result.ok) {
                setError(result.error);
                toast.error(result.error);
                return;
              }
              toast.success(`Laundry tamu berhasil dicatat. Total ${money(result.orderTotal)}.${directCash ? ` Kembalian ${money(result.change)}.` : ""}`);
              setOpen(false);
              reset();
              router.refresh();
            } catch {
              const message = "Hasil penyimpanan belum dapat dipastikan. Periksa folio kamar sebelum mencoba lagi agar tidak tercatat ganda.";
              setError(message);
              toast.error(message);
            } finally {
              submitting.current = false;
            }
          });
        }}>
          <fieldset disabled={pending} className="min-w-0 space-y-4">
            <legend className="sr-only">Rincian laundry tamu</legend>
            <label className="block text-sm font-medium">Kamar dan tamu
              <select name="roomId" required defaultValue="" className={controlClass}>
                <option value="" disabled>Pilih kamar</option>
                {rooms.map((room) => <option key={room.id} value={room.id}>Kamar {room.number} — {room.guestName}</option>)}
              </select>
            </label>
            <div className="space-y-3">
              {rows.map((row, index) => (
                <fieldset key={row.key} className="min-w-0 rounded-lg border p-3">
                  <legend className="px-1 text-sm font-semibold">Cucian {index + 1}</legend>
                  <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                    <label className="block min-w-0 text-sm font-medium sm:col-span-2">Jenis layanan
                      <select required value={row.articleId} className={controlClass} onChange={(event) => {
                        const article = catalog.find((item) => item.id === Number(event.target.value));
                        updateRow(row.key, { articleId: event.target.value, unitPrice: article?.defaultPrice == null ? "" : String(article.defaultPrice) });
                      }}>
                        <option value="" disabled>Pilih layanan laundry</option>
                        {catalog.map((article) => <option key={article.id} value={article.id}>{article.name} ({article.code})</option>)}
                      </select>
                    </label>
                    <label className="block text-sm font-medium">Jumlah (potong)
                      <input type="number" inputMode="numeric" min={1} step={1} required value={row.quantity} onChange={(event) => updateRow(row.key, { quantity: event.target.value })} className={controlClass} />
                    </label>
                    <label className="block text-sm font-medium">Harga per potong (Rp)
                      <input type="number" inputMode="numeric" min={0} step={1} required value={row.unitPrice} onChange={(event) => updateRow(row.key, { unitPrice: event.target.value })} className={controlClass} />
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">Subtotal: <span className="num font-semibold text-foreground">{validAmounts ? money(calculateGuestLaundryTotal([items[index]])) : "—"}</span></p>
                    <Button type="button" variant="ghost" className="min-h-11" disabled={rows.length === 1} aria-label={`Hapus cucian ${index + 1}`} onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}>
                      <Trash2 className="size-4" aria-hidden="true" />Hapus
                    </Button>
                  </div>
                </fieldset>
              ))}
              <Button type="button" variant="outline" className="min-h-11" onClick={() => { const row = emptyRow(nextKey.current++); setRows((current) => [...current, row]); }}>
                <Plus className="size-4" aria-hidden="true" />Tambah Cucian
              </Button>
            </div>
            <div className="flex flex-wrap justify-between gap-3 rounded-lg bg-muted/50 p-4 text-sm" aria-live="polite" aria-atomic="true">
              <p>Total potong: <strong className="num">{validAmounts ? formatDecimalID(pieces, 0) : "—"}</strong></p>
              <p>Total biaya: <strong className="num">{validAmounts ? money(total) : "—"}</strong></p>
            </div>
            {!validAmounts && <p role="alert" className="text-sm text-destructive">Jumlah harus berupa potong utuh dan harga dalam rupiah utuh. Periksa nilai cucian atau total yang melampaui batas.</p>}
            <label className="block text-sm font-medium">Penyelesaian pembayaran
              <select value={settlement} onChange={(event) => { setSettlement(event.target.value as GuestLaundryOrderInput["settlementType"]); setCashTendered(""); }} className={controlClass}>
                <option value="CHARGE_TO_ROOM">Beban ke Kamar (Folio)</option>
                <option value="DIRECT_TENDER">Bayar Langsung</option>
              </select>
            </label>
            {settlement === "DIRECT_TENDER" && <label className="block text-sm font-medium">Metode pembayaran
              <select value={paymentMethod} onChange={(event) => { setPaymentMethod(event.target.value as NonNullable<GuestLaundryOrderInput["paymentMethod"]>); setCashTendered(""); }} className={controlClass}>
                <option value="CASH">Tunai</option><option value="CARD">Kartu</option><option value="QRIS">QRIS</option><option value="TRANSFER">Transfer</option>
              </select>
            </label>}
            {directCash && <div className="space-y-2">
              <label className="block text-sm font-medium">Uang diterima (Rp)
                <input type="number" inputMode="numeric" min={total} step={1} required value={cashTendered} onChange={(event) => setCashTendered(event.target.value)} aria-describedby="guest-laundry-cash-hint" aria-invalid={cashTendered !== "" && insufficientCash} className={controlClass} />
              </label>
              <p id="guest-laundry-cash-hint" className={`text-sm ${cashTendered !== "" && insufficientCash ? "text-destructive" : "text-muted-foreground"}`} aria-live="polite">
                {insufficientCash ? "Masukkan uang diterima minimal sebesar total biaya." : `Kembalian: ${money(cash - total)}`}
              </p>
            </div>}
            <label className="block text-sm font-medium">Catatan (opsional)
              <textarea name="notes" rows={3} maxLength={255} className={`${controlClass} h-auto py-3`} placeholder="Kondisi pakaian atau instruksi khusus (maks. 255 karakter)" />
            </label>
          </fieldset>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" className="min-h-11" disabled={pending || !validAmounts || insufficientCash}>
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}{pending ? "Menyimpan..." : "Simpan Laundry Tamu"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
