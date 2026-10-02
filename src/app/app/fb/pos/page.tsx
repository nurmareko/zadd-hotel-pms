import { FBOrderStatus } from "@prisma/client";

import { parseFBOrderItemNotes } from "@/lib/fb-order-guest";
import { computeFBOrderTotals } from "@/lib/fb-order-totals";
import { prisma } from "@/lib/prisma";

import { RestaurantPos } from "./restaurant-pos";
import type { PosOrder } from "./pos-types";

export const dynamic = "force-dynamic";

export default async function RestaurantPosPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const params = await searchParams;
  const activeStatuses = [FBOrderStatus.OPEN, FBOrderStatus.BILLED];
  const [tables, orders, menuItems, settings] = await Promise.all([
    prisma.restaurantTable.findMany({
      include: {
        orders: {
          where: { status: { in: activeStatuses } },
          select: { id: true },
          orderBy: { openedAt: "asc" },
        },
      },
      orderBy: [{ location: "asc" }, { number: "asc" }],
    }),
    prisma.fBOrder.findMany({
      where: { status: { in: activeStatuses } },
      include: {
        table: { select: { number: true } },
        waitedBy: { select: { fullName: true } },
        chargedFolio: {
          select: {
            folioNo: true,
            reservation: {
              select: {
                room: { select: { number: true } },
                guest: { select: { fullName: true } },
              },
            },
          },
        },
        items: {
          include: { menuItem: { select: { name: true } } },
          orderBy: { id: "asc" },
        },
      },
      orderBy: { openedAt: "asc" },
    }),
    prisma.menuItem.findMany({
      where: { isActive: true },
      select: { id: true, name: true, category: true, price: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.hotelSettings.findUnique({ where: { id: 1 } }),
  ]);

  if (!settings) {
    return <main className="p-6"><h1 className="text-2xl font-bold">POS Restoran</h1><p role="alert" className="mt-4">Pengaturan hotel belum tersedia. Hubungi administrator sebelum memproses pesanan.</p></main>;
  }

  const posOrders: PosOrder[] = orders.map((order) => {
    const totals = computeFBOrderTotals(order.items, settings);
    const attachedRoomFolio = order.serviceType === "ROOM_SERVICE" && order.chargedFolio
      ? {
          roomNumber: order.chargedFolio.reservation.room?.number ?? "-",
          guestName: order.chargedFolio.reservation.guest.fullName,
          folioNo: order.chargedFolio.folioNo,
        }
      : null;
    return {
      id: order.id,
      orderNo: order.orderNo,
      tableId: order.tableId,
      serviceType: order.serviceType,
      status: order.status,
      destination: order.serviceType === "ROOM_SERVICE"
        ? `Kamar ${attachedRoomFolio?.roomNumber ?? "-"}`
        : `Meja ${order.table?.number ?? order.tableNo ?? "-"}`,
      guestCount: order.guestCount,
      waiterName: order.waitedBy.fullName,
      kitchenStartedAt: order.kitchenStartedAt?.toISOString() ?? null,
      kitchenReadyAt: order.kitchenReadyAt?.toISOString() ?? null,
      attachedRoomFolio,
      totals: {
        subtotal: totals.subtotal.toFixed(0),
        serviceCharge: totals.serviceCharge.toFixed(0),
        tax: totals.tax.toFixed(0),
        total: totals.total.toFixed(0),
      },
      items: order.items.map((item) => ({
        id: item.id,
        name: item.menuItem.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
        amount: item.amount.toString(),
        ...parseFBOrderItemNotes(item.notes),
      })),
    };
  });
  const requestedId = Number(params.orderId);
  const initialOrderId = posOrders.some((order) => order.id === requestedId) ? requestedId : null;

  return (
    <RestaurantPos
      key={params.orderId ?? "new"}
      initialOrderId={initialOrderId}
      orders={posOrders}
      tables={tables.map((table) => ({
        id: table.id,
        number: table.number,
        capacity: table.capacity,
        location: table.location,
        status: table.status,
        posX: table.posX,
        posY: table.posY,
        notes: table.notes,
        orderIds: table.orders.map((order) => order.id),
      }))}
      menuItems={menuItems.map((item) => ({ ...item, price: item.price.toString() }))}
      settings={{
        serviceChargePercent: settings.serviceChargePercent.toString(),
        taxPercent: settings.taxPercent.toString(),
      }}
    />
  );
}
