"use client";

import { ShoppingCart } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { fbOrderGuestLabel } from "@/lib/fb-order-guest";
import { formatIDR } from "@/lib/format";

import { OrderActions } from "./order-actions";
import { OrderItemRow, type OrderCartItem } from "./order-item-row";

export type OrderCartData = {
  id: number;
  orderNo: string;
  status: string;
  tableNo: string;
  guestCount: number;
  subtotal: string;
  serviceCharge: string;
  tax: string;
  total: string;
  items: OrderCartItem[];
};

type OrderCartProps = {
  order: OrderCartData;
  settings: {
    serviceChargePercent: string;
    taxPercent: string;
  };
};

function shouldShowAmount(amount: string) {
  return Number(amount) > 0;
}

export function OrderCart({ order, settings }: OrderCartProps) {
  const canEdit = order.status === "OPEN";
  const itemsByGuest = Array.from(
    order.items.reduce((groups, item) => {
      const guestNumber = item.guestNumber || 1;
      const currentItems = groups.get(guestNumber) ?? [];

      currentItems.push(item);
      groups.set(guestNumber, currentItems);

      return groups;
    }, new Map<number, OrderCartItem[]>()),
  ).sort(([firstGuest], [secondGuest]) => firstGuest - secondGuest);

  return (
    <aside className="border border-console-border bg-console-surface xl:sticky xl:top-4 xl:max-h-[calc(100vh-6rem)] xl:self-start xl:overflow-y-auto">
      <div className="border-b border-console-border bg-console-ink px-3.5 py-2">
        <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
          {"// KERANJANG ORDER"}
        </div>
        <div className="mt-1 text-[11px] text-slate-300">
          Meja {order.tableNo} · {order.guestCount} pax · {order.orderNo}
        </div>
      </div>

      {order.items.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Keranjang masih kosong"
          description="Pilih menu dari kolom kiri untuk menambahkan item order."
          className="m-3.5"
        />
      ) : (
        <div>
          {itemsByGuest.map(([guestNumber, guestItems]) => (
            <section key={guestNumber}>
              <div className="border-b border-console-border-soft bg-console-bg px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600">
                {fbOrderGuestLabel(guestNumber)}
              </div>
              {guestItems.map((item) => (
                <OrderItemRow canEdit={canEdit} item={item} key={item.id} />
              ))}
            </section>
          ))}
        </div>
      )}

      <div className="border-t border-console-border bg-console-bg p-3.5 text-[13px]">
        <div className="flex items-center justify-between py-1">
          <span className="text-slate-600">Subtotal</span>
          <span className="num font-semibold text-console-ink">
            {formatIDR(order.subtotal)}
          </span>
        </div>
        {shouldShowAmount(order.serviceCharge) ? (
          <div className="flex items-center justify-between py-1">
            <span className="text-slate-600">
              Service {Number(settings.serviceChargePercent)}%
            </span>
            <span className="num text-console-ink">
              {formatIDR(order.serviceCharge)}
            </span>
          </div>
        ) : null}
        {shouldShowAmount(order.tax) ? (
          <div className="flex items-center justify-between py-1">
            <span className="text-slate-600">PPN {Number(settings.taxPercent)}%</span>
            <span className="num text-console-ink">{formatIDR(order.tax)}</span>
          </div>
        ) : null}
        <div className="mt-2 border-t border-console-border pt-2">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-bold uppercase tracking-[0.04em] text-console-ink">
              Total
            </span>
            <span className="num text-[20px] font-bold text-console-ink">
              {formatIDR(order.total)}
            </span>
          </div>
        </div>
      </div>

      <OrderActions
        canEdit={canEdit}
        hasItems={order.items.length > 0}
        orderId={order.id}
      />
    </aside>
  );
}
