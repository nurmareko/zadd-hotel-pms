"use client";

import { useState, type ReactNode } from "react";
import { Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDecimalID } from "@/lib/format";
import type { GuestLaundryOrderRecord } from "@/lib/laundry/data";
import type { GuestLaundryStatus } from "@/lib/laundry/guest-schema";
import { GuestLaundryStatusAction } from "./guest-laundry-status-action";

const statuses = {
  RECEIVED: { label: "Received", className: "border-amber-200 bg-amber-50 text-amber-800" },
  WASHING: { label: "Washing", className: "border-blue-200 bg-blue-50 text-blue-800" },
  READY_FOR_RETURN: { label: "Ready for Return", className: "border-violet-200 bg-violet-50 text-violet-800" },
  DELIVERED: { label: "Delivered", className: "border-green-200 bg-green-50 text-green-800" },
} satisfies Record<GuestLaundryStatus, { label: string; className: string }>;
const hotelDateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
});

function OrderTime({ value }: { value: Date | string | null }) {
  if (!value) return <>Time unavailable</>;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <>Time unavailable</>;
  return <time dateTime={date.toISOString()}>{hotelDateTime.format(date)} WIB</time>;
}

function OrderCell({ label, children, numeric = false }: { label: string; children: ReactNode; numeric?: boolean }) {
  return (
    <td role="cell" className={`block min-w-0 break-words px-3 py-2 align-top xl:table-cell xl:px-4 xl:py-3 ${numeric ? "num xl:text-right" : ""}`}>
      <span className="mb-1 block text-xs font-medium text-muted-foreground xl:hidden">{label}</span>
      {children}
    </td>
  );
}

export function GuestLaundryOrders({ orders }: { orders: GuestLaundryOrderRecord[] }) {
  const [showAll, setShowAll] = useState(false);
  const visibleOrders = showAll ? orders : orders.filter((order) => order.status !== "DELIVERED");

  return (
    <section className="min-w-0 space-y-4 border-t pt-4" aria-label="Guest laundry orders">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{showAll ? "All Orders" : "Active Orders"}</h3>
          <p className="mt-1 text-sm text-muted-foreground" role="status">{visibleOrders.length.toLocaleString("id-ID")} orders · Times shown in hotel time (WIB).</p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter guest laundry orders">
          <Button type="button" variant={showAll ? "outline" : "default"} className="min-h-11" aria-pressed={!showAll} onClick={() => setShowAll(false)}>Active</Button>
          <Button type="button" variant={showAll ? "default" : "outline"} className="min-h-11" aria-pressed={showAll} onClick={() => setShowAll(true)}>All Orders</Button>
        </div>
      </div>
      {visibleOrders.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-8 text-center" role="status">
          <Shirt className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">{showAll ? "No guest laundry orders yet." : "No active guest laundry orders."}</p>
          <p className="mt-1 text-sm text-muted-foreground">{showAll ? "Select Record Guest Laundry to create an order." : "Select All Orders to review deliveries, or record a new order."}</p>
        </div>
      ) : (
        <table role="table" className="block w-full text-sm xl:table xl:table-fixed">
          <caption className="sr-only">Guest laundry orders and processing actions</caption>
          <thead role="rowgroup" className="sr-only xl:not-sr-only xl:table-header-group">
            <tr role="row">
              {["Room", "Guest", "Items", "Amount", "Settlement", "Received", "Status", "Actions"].map((label) => (
                <th key={label} scope="col" className={`border-b px-4 py-3 text-xs font-medium text-muted-foreground ${label === "Amount" ? "text-right" : "text-left"}`}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody role="rowgroup" className="block space-y-3 xl:table-row-group xl:space-y-0">
            {visibleOrders.map((order) => (
              <tr role="row" key={order.id} className="grid grid-cols-1 rounded-lg border py-2 sm:grid-cols-2 xl:table-row xl:rounded-none xl:border-x-0 xl:border-t-0 xl:border-b xl:border-border/60 xl:py-0">
                <OrderCell label="Room"><p className="num font-semibold">{order.roomNumber || "Room unavailable"}</p><p className="mt-1 text-xs text-muted-foreground">Order #{order.id}</p></OrderCell>
                <OrderCell label="Guest">{order.guestName || "Guest name unavailable"}</OrderCell>
                <OrderCell label="Items">
                  {order.items?.length ? <ul className="space-y-2">{order.items.map((item, index) => (
                    <li key={`${item.articleId}-${index}`}><span className="num">{formatDecimalID(item.quantity, 0)} × </span>{item.name}<p className="num text-xs text-muted-foreground">Rp {formatDecimalID(item.unitPrice)} per piece</p></li>
                  ))}</ul> : <p className="text-muted-foreground">Item details unavailable for this legacy order.</p>}
                </OrderCell>
                <OrderCell label="Amount" numeric>Rp {formatDecimalID(order.amount)}</OrderCell>
                <OrderCell label="Settlement">{order.settlementType === "CHARGE_TO_ROOM" ? "Folio" : order.settlementType === "DIRECT_TENDER" ? "Paid" : "Settlement unavailable"}</OrderCell>
                <OrderCell label="Received"><OrderTime value={order.createdAt} /></OrderCell>
                <OrderCell label="Status"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statuses[order.status].className}`}>{statuses[order.status].label}</span></OrderCell>
                <OrderCell label={order.status === "DELIVERED" ? "Delivery details" : "Actions"}>
                  {order.status === "DELIVERED" ? <div className="space-y-1 text-xs text-muted-foreground">
                    <p>Delivered by <span className="font-medium text-foreground">{order.deliveredByName || "Attendant unavailable"}</span></p>
                    <p className="num"><OrderTime value={order.deliveredAt} /></p>
                    <p className="whitespace-pre-wrap">{order.deliveryNotes || "No delivery notes."}</p>
                  </div> : <GuestLaundryStatusAction key={order.status} orderLogId={order.id} status={order.status} roomNumber={order.roomNumber} guestName={order.guestName} />}
                </OrderCell>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
