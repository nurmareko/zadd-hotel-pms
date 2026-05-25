import { notFound } from "next/navigation";

import { parseFBOrderItemNotes } from "@/lib/fb-order-guest";
import { computeFBOrderTotals } from "@/lib/fb-order-totals";
import { formatIDR } from "@/lib/format";
import { prisma } from "@/lib/prisma";

import { MenuBrowse } from "./menu-browse";
import { OrderCart } from "./order-cart";

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

  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
            <span className="text-console-accent">▸ </span>
            Captain Order · Meja {order.table?.number ?? order.tableNo ?? "-"}
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            Order #{order.orderNo} ·{" "}
            <span className="num">{order.guestCount}</span> pax ·{" "}
            <span className="num">{itemCount}</span> item ·{" "}
            {formatIDR(computedTotals.total.toString())}
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
            tableNo: order.table?.number ?? order.tableNo ?? "-",
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
