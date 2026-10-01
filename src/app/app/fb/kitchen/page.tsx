import { FBOrderServiceType, FBOrderStatus } from "@prisma/client";
import { ChefHat } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";

import { KitchenDisplay } from "./kitchen-display";

export const dynamic = "force-dynamic";

export default async function KitchenDisplayPage() {
  const orders = await prisma.fBOrder.findMany({
    where: {
      status: { in: [FBOrderStatus.OPEN, FBOrderStatus.BILLED] },
      kitchenReadyAt: null,
      items: { some: {} },
    },
    select: {
      id: true,
      orderNo: true,
      serviceType: true,
      tableNo: true,
      guestCount: true,
      openedAt: true,
      kitchenStartedAt: true,
      waitedBy: { select: { fullName: true } },
      chargedFolio: {
        select: {
          reservation: {
            select: { room: { select: { number: true } } },
          },
        },
      },
      items: {
        select: {
          id: true,
          quantity: true,
          notes: true,
          menuItem: { select: { name: true, category: true } },
        },
        orderBy: { id: "asc" },
      },
    },
    orderBy: { openedAt: "asc" },
  });

  const tickets = orders.map((order) => {
    const isRoomService = order.serviceType === FBOrderServiceType.ROOM_SERVICE;
    const roomNumber = order.chargedFolio?.reservation.room?.number;

    return {
      id: order.id,
      orderNo: order.orderNo,
      destination: isRoomService ? `Kamar ${roomNumber ?? "-"}` : `Meja ${order.tableNo ?? "-"}`,
      serviceLabel: isRoomService ? "Layanan Kamar" : "Makan di Tempat",
      waiterName: order.waitedBy.fullName,
      guestCount: order.guestCount,
      openedAt: order.openedAt.toISOString(),
      kitchenStartedAt: order.kitchenStartedAt?.toISOString() ?? null,
      items: order.items.map((item) => ({
        id: item.id,
        name: item.menuItem.name,
        category: item.menuItem.category,
        quantity: item.quantity,
        notes: item.notes,
      })),
    };
  });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-4 font-sans text-slate-900 md:px-6 md:py-5">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ChefHat className="size-6 text-emerald-700" aria-hidden="true" />
            <h1 className="text-3xl font-bold leading-tight">Layar Dapur</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">Pantau pesanan aktif dan waktu persiapannya secara langsung.</p>
        </div>
        <Link className={buttonVariants({ variant: "outline" })} href="/app/fb">
          Kembali ke Meja
        </Link>
      </div>

      <KitchenDisplay tickets={tickets} initialNow={new Date().toISOString()} />
    </main>
  );
}
