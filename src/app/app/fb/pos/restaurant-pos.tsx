"use client";

import type { FBOrderServiceType } from "@prisma/client";
import { ChefHat, Maximize, Minimize, Plus, Printer, RefreshCw, Search, ShoppingBag, Split, Trash2, Users, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { addItemToOrder, voidOrder } from "@/app/app/fb/orders/[orderId]/actions";
import { confirmBill, reopenOrder } from "@/app/app/fb/orders/[orderId]/bill/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatIDR } from "@/lib/format";

import { ActiveBillsStrip } from "./active-bills-strip";
import { PosCartItem, type PosMutation } from "./pos-cart-item";
import { PosNewOrderDialog } from "./pos-new-order-dialog";
import { PosPaymentDialog } from "./pos-payment-dialog";
import { filterMenuItems, handlePosHotkey, POS_CATEGORIES, selectActiveOrder } from "./pos-state";
import type { PosMenuItem, PosOrder, PosSettings, PosTable } from "./pos-types";
import { RunningTablesSidebar } from "./running-tables-sidebar";

type PaymentRequest = { orderId: number; split: boolean };

export function RestaurantPos({ tables, orders, menuItems, settings, initialOrderId }: {
  tables: PosTable[];
  orders: PosOrder[];
  menuItems: PosMenuItem[];
  settings: PosSettings;
  initialOrderId: number | null;
}) {
  const router = useRouter();
  const [activeOrderId, setActiveOrderId] = useState(initialOrderId);
  const [serviceType, setServiceType] = useState<FBOrderServiceType>(selectActiveOrder(orders, initialOrderId)?.serviceType ?? "DINE_IN");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [newOrder, setNewOrder] = useState<{ table: PosTable | null } | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [payment, setPayment] = useState<{ order: PosOrder; split: boolean } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const busy = useRef(false);

  const activeOrder = selectActiveOrder(orders, activeOrderId);
  const modalOpen = Boolean(newOrder || voidOpen || paymentRequest || payment);
  const disabled = isPending || modalOpen;
  const canEdit = activeOrder?.status === "OPEN" && !disabled;
  const hasItems = Boolean(activeOrder?.items.length);
  const visibleItems = filterMenuItems(menuItems, category, search);

  // Wait for the authoritative BILLED payload, then retain it through settlement
  // revalidation so a closed order disappearing cannot erase the receipt result.
  const billedOrder = paymentRequest ? selectActiveOrder(orders, paymentRequest.orderId) : null;
  if (paymentRequest && billedOrder?.status === "BILLED") {
    setPayment({ order: billedOrder, split: paymentRequest.split });
    setPaymentRequest(null);
  }

  const mutate: PosMutation = (action, onSuccess) => {
    if (busy.current || isPending) return;
    busy.current = true;
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) toast.error(result.error);
        else onSuccess?.();
        router.refresh();
      } catch {
        toast.error("Tindakan belum dapat dikonfirmasi. Muat ulang pesanan sebelum mencoba lagi.");
        router.refresh();
      } finally {
        busy.current = false;
      }
    });
  };

  function selectOrder(id: number) {
    if (disabled) return;
    const order = selectActiveOrder(orders, id);
    if (!order) return;
    setActiveOrderId(order.id);
    setServiceType(order.serviceType);
  }

  function changeService(next: FBOrderServiceType) {
    if (disabled) return;
    setServiceType(next);
    if (activeOrder?.serviceType !== next) setActiveOrderId(null);
  }

  function openNewOrder(table: PosTable | null = null) {
    if (disabled) return;
    if (table) setServiceType("DINE_IN");
    setNewOrder({ table });
  }

  function openPayment(split = false) {
    if (disabled || !activeOrder || !hasItems) return;
    if (activeOrder.status === "BILLED") {
      setPayment({ order: activeOrder, split });
    } else {
      mutate(() => confirmBill({ orderId: activeOrder.id }), () => {
        setPaymentRequest({ orderId: activeOrder.id, split });
      });
    }
  }

  function sendToKitchen() {
    if (disabled || !activeOrder || !hasItems) return;
    toast.success("Item yang tersimpan otomatis masuk ke layar dapur.");
    startTransition(() => router.refresh());
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => handlePosHotkey(event, {
      newOrder: () => openNewOrder(),
      pay: () => openPayment(),
      sendToKitchen,
    }, disabled || busy.current);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  useEffect(() => {
    const refresh = () => {
      if (isPending || modalOpen || busy.current || document.visibilityState !== "visible") return;
      if (document.activeElement?.matches("input, textarea, select")) return;
      startTransition(() => router.refresh());
    };
    const interval = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", refresh); };
  }, [router, isPending, modalOpen]);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      toast.error("Mode layar penuh tidak tersedia di peramban ini.");
    }
  }

  return (
    <main className="min-h-screen min-w-0 bg-slate-50 p-4 text-slate-900 md:p-5 xl:p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div><div className="flex items-center gap-2"><UtensilsCrossed aria-hidden="true" className="size-6 text-primary" /><h1 className="text-2xl font-bold">POS Restoran</h1></div><p className="mt-1 text-sm text-slate-500">Meja, pesanan, dan pembayaran dalam satu layar.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="size-11" aria-label={fullscreen ? "Keluar layar penuh" : "Layar penuh"} onClick={toggleFullscreen}>{fullscreen ? <Minimize aria-hidden="true" /> : <Maximize aria-hidden="true" />}</Button>
          <Button type="button" variant="outline" className="size-11" aria-label="Muat ulang pesanan" disabled={disabled} onClick={() => startTransition(() => router.refresh())}><RefreshCw aria-hidden="true" className={isPending ? "animate-spin" : ""} /></Button>
          <Link href="/app/fb" className={buttonVariants({ variant: "outline", className: "min-h-11" })}>Kembali ke Dasbor</Link>
          <Button type="button" className="min-h-11" disabled={disabled} onClick={() => openNewOrder()}><Plus aria-hidden="true" />[F2] Pesanan Baru</Button>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap gap-2" aria-label="Jenis layanan">
        {([ ["DINE_IN", "Makan di Tempat"], ["ROOM_SERVICE", "Layanan Kamar"] ] as const).map(([value, label]) => <Button key={value} type="button" className="min-h-11" variant={serviceType === value ? "default" : "outline"} aria-pressed={serviceType === value} disabled={disabled} onClick={() => changeService(value)}>{label}</Button>)}
      </div>
      <ActiveBillsStrip orders={orders.filter((order) => order.serviceType === serviceType)} activeOrderId={activeOrderId} disabled={disabled} onSelect={selectOrder} />

      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.85fr)] xl:grid-cols-[14rem_minmax(0,1fr)_22rem]">
        <div className="min-w-0 lg:col-span-2 xl:col-span-1"><RunningTablesSidebar tables={tables} orders={orders} activeOrderId={activeOrderId} serviceType={serviceType} disabled={disabled} onSelectOrder={selectOrder} onSelectTable={openNewOrder} onServiceTypeChange={changeService} /></div>
        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="pos-menu-heading">
          <div className="mb-4 flex items-center justify-between gap-2"><h2 id="pos-menu-heading" className="text-lg font-semibold">Daftar Menu</h2><span className="text-xs text-slate-500">{visibleItems.length} menu</span></div>
          <div className="relative"><Search aria-hidden="true" className="absolute left-3 top-3.5 size-4 text-slate-400" /><Input type="search" aria-label="Cari menu" placeholder="Cari menu..." className="h-11 pl-10" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          <div className="my-4 flex flex-wrap gap-2" aria-label="Kategori menu">{POS_CATEGORIES.map((item) => <Button key={item.value} type="button" className="min-h-11 rounded-full" variant={category === item.value ? "default" : "outline"} aria-pressed={category === item.value} onClick={() => setCategory(item.value)}>{item.label}</Button>)}</div>
          {!activeOrder && <p className="mb-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600">Pilih meja atau buat pesanan baru sebelum menambahkan menu.</p>}
          {visibleItems.length === 0 ? <p role="status" className="py-12 text-center text-sm text-slate-500">Tidak ada menu yang sesuai. Coba kata kunci atau kategori lain.</p> : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {visibleItems.map((item) => <article key={item.id} className="flex min-h-36 flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4"><h3 className="break-words font-semibold">{item.name}</h3><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium tabular-nums">{formatIDR(item.price)}</span><Button type="button" className="size-11" aria-label={`Tambah ${item.name} ke pesanan`} disabled={!canEdit} onClick={() => { if (activeOrder) mutate(() => addItemToOrder({ orderId: activeOrder.id, menuItemId: item.id, quantity: 1 })); }}><Plus aria-hidden="true" /></Button></div></article>)}
          </div>}
        </section>

        <section className="min-w-0 self-start overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm" aria-labelledby="pos-cart-heading" aria-busy={isPending}>
          <div className="border-b p-4"><div className="flex items-center justify-between gap-2"><h2 id="pos-cart-heading" className="text-lg font-semibold">{activeOrder?.destination ?? "Belum ada pesanan"}</h2>{activeOrder && <span className="flex items-center gap-1 text-sm"><Users aria-hidden="true" className="size-4" />{activeOrder.guestCount} tamu</span>}</div>{activeOrder && <p className="mt-1 text-xs text-slate-500">KOT {activeOrder.orderNo} · {activeOrder.waiterName}</p>}</div>
          {!activeOrder ? <div className="p-8 text-center text-sm text-slate-500"><ShoppingBag aria-hidden="true" className="mx-auto mb-3 size-8" />Pilih pesanan dari meja atau daftar tagihan aktif.</div> : <>
            {activeOrder.status === "BILLED" && <div className="border-b bg-amber-50 p-4 text-sm text-amber-900"><p>Tagihan dikonfirmasi. Item terkunci sampai pesanan dibuka kembali.</p><Button type="button" className="mt-2 min-h-11" variant="outline" disabled={disabled} onClick={() => mutate(() => reopenOrder({ orderId: activeOrder.id }))}>Buka Kembali Pesanan</Button></div>}
            <ul>{activeOrder.items.map((item) => <PosCartItem key={`${item.id}:${item.notes}`} item={item} disabled={!canEdit} mutate={mutate} />)}</ul>
            {!hasItems && <p className="p-6 text-center text-sm text-slate-500">Pesanan masih kosong. Tambahkan menu untuk mulai.</p>}
            <dl className="space-y-2 border-t bg-slate-50/50 p-4 text-sm tabular-nums">{([
              ["Subtotal", activeOrder.totals.subtotal],
              [`Biaya Layanan (${settings.serviceChargePercent}%)`, activeOrder.totals.serviceCharge],
              [`Pajak PB1 (${settings.taxPercent}%)`, activeOrder.totals.tax],
              ["Total", activeOrder.totals.total],
            ]).map(([label, amount]) => <div key={label} className="flex justify-between gap-3 last:border-t last:pt-3 last:text-lg last:font-bold"><dt>{label}</dt><dd>{formatIDR(amount)}</dd></div>)}</dl>
          </>}
          <div className="space-y-2 border-t p-4">
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="min-h-12 whitespace-normal" disabled={disabled || !hasItems} onClick={() => { if (activeOrder) window.open(`/api/fb-orders/${activeOrder.id}/bill`, "_blank", "noopener,noreferrer"); }}><Printer aria-hidden="true" />Cetak Tagihan</Button>
              <Button type="button" variant="outline" className="min-h-12 whitespace-normal" disabled={disabled || !hasItems} onClick={() => openPayment(true)}><Split aria-hidden="true" />Split Tagihan</Button>
              <Button type="button" variant="outline" className="min-h-12 whitespace-normal" disabled={disabled || !activeOrder} onClick={() => { setActiveOrderId(null); toast.success("Pesanan tetap tersimpan dan dapat dibuka kembali dari daftar tagihan."); }}>Tahan Tagihan</Button>
              <Button type="button" variant="outline" className="min-h-12 whitespace-normal text-destructive" disabled={!canEdit} onClick={() => { setVoidReason(""); setVoidOpen(true); }}><Trash2 aria-hidden="true" />Batal / Void</Button>
            </div>
            <Button type="button" variant="outline" className="min-h-12 w-full whitespace-normal" disabled={disabled || !hasItems} onClick={sendToKitchen}><ChefHat aria-hidden="true" />[F6] Kirim ke Dapur</Button>
            <Button type="button" className="min-h-14 w-full whitespace-normal text-base" disabled={disabled || !hasItems} onClick={() => openPayment()}>[F4] Bayar / Selesai</Button>
            <p className="pt-1 text-center text-xs leading-5 text-slate-500">Item tersimpan otomatis. Simpan catatan sebelum melanjutkan. Pesanan tersimpan langsung terlihat di dapur.</p>
          </div>
        </section>
      </div>

      {newOrder && <PosNewOrderDialog serviceType={serviceType} tables={tables} table={newOrder.table} onClose={() => setNewOrder(null)} />}
      {paymentRequest && <Dialog open onOpenChange={(open) => { if (!open) setPaymentRequest(null); }}><DialogContent><DialogHeader><DialogTitle>Memuat tagihan</DialogTitle><DialogDescription>Menunggu data tagihan terbaru sebelum pembayaran.</DialogDescription></DialogHeader><Button type="button" onClick={() => startTransition(() => router.refresh())} disabled={isPending}>Muat Ulang</Button><Button type="button" variant="outline" onClick={() => setPaymentRequest(null)}>Batal</Button></DialogContent></Dialog>}
      {payment && <PosPaymentDialog order={payment.order} settings={settings} split={payment.split} onClose={() => { setPayment(null); startTransition(() => router.refresh()); }} onSettled={() => startTransition(() => router.refresh())} />}
      <Dialog open={voidOpen} onOpenChange={(open) => { if (!busy.current) setVoidOpen(open); }}>
        <DialogContent showCloseButton={false}><DialogHeader><DialogTitle>Batalkan pesanan ini?</DialogTitle><DialogDescription>Pesanan {activeOrder?.orderNo} akan dibatalkan. Tindakan ini tidak dapat dibatalkan.</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (activeOrder) mutate(() => voidOrder({ orderId: activeOrder.id, reason: voidReason }), () => { setVoidOpen(false); setActiveOrderId(null); toast.success("Pesanan dibatalkan."); }); }}>
            <label className="block space-y-2"><span>Alasan pembatalan</span><Input required maxLength={255} className="h-11" value={voidReason} disabled={isPending} onChange={(event) => setVoidReason(event.target.value)} /></label>
            <DialogFooter><Button type="button" className="min-h-11" variant="outline" disabled={isPending} onClick={() => setVoidOpen(false)}>Kembali</Button><Button type="submit" className="min-h-11" variant="destructive" disabled={isPending || !voidReason.trim()}>Konfirmasi Void</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
