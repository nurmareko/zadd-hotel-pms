"use client";

import { ReceiptText } from "lucide-react";
import { formatIDR } from "@/lib/format";
import { selectActiveOrder } from "./pos-state";
import type { PosOrder } from "./pos-types";

export type ActiveBillsStripProps = {
  orders: PosOrder[];
  activeOrderId: number | null;
  disabled?: boolean;
  onSelect: (orderId: number) => void;
};

export function ActiveBillsStrip({ orders, activeOrderId, disabled = false, onSelect }: ActiveBillsStripProps) {
  const activeOrder = selectActiveOrder(orders, activeOrderId);
  const runningOrders = orders.filter((order) => order.status === "OPEN" || order.status === "BILLED");

  return (
    <section aria-label="Tagihan aktif" className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
        <ReceiptText aria-hidden="true" className="size-4" />
        Tagihan aktif <span className="text-sm font-normal text-muted-foreground">({runningOrders.length})</span>
      </h2>
      {runningOrders.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada tagihan aktif. Pilih meja atau buat pesanan baru.</p>
      ) : (
        <ul className="flex gap-2 overflow-x-auto pb-2">
          {runningOrders.map((order) => (
            <li key={order.id} className="w-64 max-w-full shrink-0">
              <button
                type="button"
                disabled={disabled}
                aria-pressed={activeOrder?.id === order.id}
                onClick={() => onSelect(order.id)}
                className="min-h-11 w-full rounded-md border border-border p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:border-ring aria-pressed:bg-accent"
              >
                <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="break-all text-sm font-semibold">KOT · {order.orderNo}</span>
                  <span className="text-sm font-semibold tabular-nums">{formatIDR(order.totals.total)}</span>
                </span>
                <span className="mt-1 block break-words text-sm text-muted-foreground">{order.destination}</span>
                <span className="mt-2 flex flex-wrap gap-1.5">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${order.kitchenReadyAt ? "bg-status-vc-bg text-status-vc-fg" : order.kitchenStartedAt ? "bg-status-vd-bg text-status-vd-fg" : "bg-status-oos-bg text-status-oos-fg"}`}>
                    {order.kitchenReadyAt ? "Siap Saji" : order.kitchenStartedAt ? "Sedang Dimasak" : "Belum Dimasak"}
                  </span>
                  {order.status === "BILLED" && (
                    <span className="rounded-full bg-status-oc-bg px-2 py-1 text-xs font-semibold text-status-oc-fg">Ditagihkan</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
