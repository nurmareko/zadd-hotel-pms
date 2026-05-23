import { FBOrderStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { RestaurantTableList } from "./table-list";

export default async function RestaurantTablesPage() {
  const tables = await prisma.restaurantTable.findMany({
    orderBy: [{ location: "asc" }, { number: "asc" }],
    select: {
      id: true,
      number: true,
      capacity: true,
      location: true,
      status: true,
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
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <RestaurantTableList
        tables={tables.map((table) => ({
          id: table.id,
          number: table.number,
          capacity: table.capacity,
          location: table.location,
          status: table.status,
          notes: table.notes,
          openOrderCount: table.orders.length,
          totalOrderCount: table._count.orders,
        }))}
      />
    </main>
  );
}
