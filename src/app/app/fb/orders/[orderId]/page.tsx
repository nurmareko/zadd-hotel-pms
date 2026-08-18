import { FBOrderServiceType } from "@prisma/client";
import { notFound } from "next/navigation";

import { parseFBOrderItemNotes } from "@/lib/fb-order-guest";
import { computeFBOrderTotals } from "@/lib/fb-order-totals";
import { formatIDR } from "@/lib/format";
import { prisma } from "@/lib/prisma";

import { OrderStatusBadge } from "../../status-badge";
import { MenuBrowse } from "./menu-browse";
import { OrderCart } from "./order-cart";

export const dynamic = "force-dynamic";

type OrderDetailPageProps = {
  params: Promise<{ orderId: string }>;
};

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { orderId } = await params;
  const id = Number(orderId) || -1;

  const [order, menuItems, settings] = await Promise.all([
    prisma.fBOrder.findUnique({
      where: { id },
      include: {
        table: { select: { id: true, number: true } },
        chargedFolio: {
          select: {
            reservation: {
              select: {
                guest: { select: { fullName: true } },
                room: { select: { number: true } },
              },
            },
          },
        },
        waitedBy: { select: { fullName: true } },
        items: {
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
                category: true,
                isActive: true,
              },
            },
          },
          orderBy: { id: "asc" },
        },
      },
    }),
    prisma.menuItem.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        category: true,
        price: true,
      },
    }),
    prisma.hotelSettings.findUnique({ where: { id: 1 } }),
  ]);

  if (!order || !settings) {
    notFound();
  }

  const computedTotals = computeFBOrderTotals(order.items, settings);
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const isRoomService = order.serviceType === FBOrderServiceType.ROOM_SERVICE;
  const roomNumber = order.chargedFolio?.reservation.room?.number ?? "-";
  const guestName = order.chargedFolio?.reservation.guest.fullName ?? "-";
  const locationLabel = isRoomService
    ? `Room Service untuk kamar ${roomNumber} / ${guestName}`
    : `Meja ${order.table?.number ?? order.tableNo ?? "-"}`;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-4 font-sans text-slate-900 md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold leading-tight text-slate-900">
            Captain Order · {locationLabel}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
            <span>
              Order{" "}
              <span className="font-semibold text-slate-700">
                {order.orderNo}
              </span>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <span className="num">{order.guestCount}</span> pax ·{" "}
              <span className="num">{itemCount}</span> item ·{" "}
              {formatIDR(computedTotals.total.toString())}
            </span>
            <OrderStatusBadge status={order.status} />
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)]">
        <MenuBrowse
          menuItems={menuItems.map((item) => ({
            id: item.id,
            name: item.name,
            category: item.category,
            price: item.price.toString(),
          }))}
          orderId={order.id}
          orderStatus={order.status}
          guestCount={order.guestCount}
        />
        <OrderCart
          order={{
            id: order.id,
            orderNo: order.orderNo,
            status: order.status,
            locationLabel,
            guestCount: order.guestCount,
            subtotal: computedTotals.subtotal.toString(),
            serviceCharge: computedTotals.serviceCharge.toString(),
            tax: computedTotals.tax.toString(),
            total: computedTotals.total.toString(),
            items: order.items.map((item) => {
              const parsedNotes = parseFBOrderItemNotes(item.notes);

              return {
                id: item.id,
                name: item.menuItem.isActive
                  ? item.menuItem.name
                  : "Item tidak tersedia",
                category: item.menuItem.category,
                isAvailable: item.menuItem.isActive,
                unitPrice: item.unitPrice.toString(),
                quantity: item.quantity,
                amount: item.amount.toString(),
                notes: parsedNotes.notes,
                guestNumber: parsedNotes.guestNumber ?? 1,
              };
            }),
          }}
          settings={{
            serviceChargePercent: settings.serviceChargePercent.toString(),
            taxPercent: settings.taxPercent.toString(),
          }}
        />
      </div>
    </main>
  );
}
