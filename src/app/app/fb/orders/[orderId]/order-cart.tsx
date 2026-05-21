"use client";

import { OrderItemRow, type OrderCartItem } from "./order-item-row";
import { OrderActions } from "./order-actions";
import { formatIDR } from "@/lib/format";

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
        <div className="p-6 text-center text-[12px] text-slate-500">
          Keranjang kosong. Pilih menu dari kolom kiri.
        </div>
      ) : (
        <div>
          {order.items.map((item) => (
            <OrderItemRow canEdit={canEdit} item={item} key={item.id} />
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
