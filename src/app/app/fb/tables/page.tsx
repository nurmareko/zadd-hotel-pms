import { FBOrderStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { RestaurantTablesTabs } from "./restaurant-tables-tabs";

export const dynamic = "force-dynamic";

export default async function RestaurantTablesPage() {
  const tables = await prisma.restaurantTable.findMany({
    orderBy: [{ location: "asc" }, { number: "asc" }],
    select: {
      id: true,
      number: true,
      capacity: true,
      location: true,
      status: true,
      posX: true,
      posY: true,
      notes: true,
      orders: {
        where: { status: FBOrderStatus.OPEN },
        select: { id: true },
      },
      _count: {
        select: { orders: true },
      },
    },
  });

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-4 text-foreground md:px-6 md:py-5">
      <RestaurantTablesTabs
        tables={tables.map((table) => ({
          id: table.id,
          number: table.number,
          capacity: table.capacity,
          location: table.location,
          status: table.status,
          posX: table.posX,
          posY: table.posY,
          notes: table.notes,
          openOrderCount: table.orders.length,
          totalOrderCount: table._count.orders,
        }))}
      />
    </main>
  );
}
