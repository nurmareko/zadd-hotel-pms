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
  locationLabel: string;
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
    <aside className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm xl:sticky xl:top-4 xl:max-h-[calc(100vh-6rem)] xl:self-start xl:overflow-y-auto">
      <div className="border-b border-gray-200 px-5 py-4">
        <div className="text-base font-semibold text-slate-900">
          Keranjang Order
        </div>
        <div className="mt-1 text-sm text-slate-500">
          {order.locationLabel} · <span className="num">{order.guestCount}</span>{" "}
          pax · <span className="font-semibold text-slate-700">{order.orderNo}</span>
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
              <div className="border-b border-gray-100 bg-slate-50 px-5 py-2.5 text-sm font-semibold text-slate-700">
                {fbOrderGuestLabel(guestNumber)}
              </div>
              {guestItems.map((item) => (
                <OrderItemRow canEdit={canEdit} item={item} key={item.id} />
              ))}
            </section>
          ))}
        </div>
      )}

      <div className="border-t border-gray-200 bg-slate-50 p-5 text-sm">
        <div className="flex items-center justify-between py-1">
          <span className="text-slate-600">Subtotal</span>
          <span className="num font-semibold text-slate-900">
            {formatIDR(order.subtotal)}
          </span>
        </div>
        {shouldShowAmount(order.serviceCharge) ? (
          <div className="flex items-center justify-between py-1">
            <span className="text-slate-600">
              Service {Number(settings.serviceChargePercent)}%
            </span>
            <span className="num text-slate-900">
              {formatIDR(order.serviceCharge)}
            </span>
          </div>
        ) : null}
        {shouldShowAmount(order.tax) ? (
          <div className="flex items-center justify-between py-1">
            <span className="text-slate-600">PPN {Number(settings.taxPercent)}%</span>
            <span className="num text-slate-900">{formatIDR(order.tax)}</span>
          </div>
        ) : null}
        <div className="mt-3 border-t border-gray-200 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">
              Total
            </span>
            <span className="num text-2xl font-bold text-slate-900">
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
