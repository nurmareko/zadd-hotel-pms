import "server-only";

import { deriveInventoryStatus } from "@/lib/fb/inventory-types";
import { prisma } from "@/lib/prisma";

export async function getAmenitiesStockSummary() {
  const ingredients = await prisma.fBIngredient.findMany({
    where: { category: "Amenities" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      unit: true,
      onHand: true,
      parLevel: true,
    },
  });
  const items = ingredients.map((item) => {
    const onHand = Number(item.onHand);
    const parLevel = Number(item.parLevel);
    return {
      ...item,
      onHand,
      parLevel,
      status: deriveInventoryStatus(onHand, parLevel),
    };
  });

  return {
    items,
    lowStockCount: items.filter((item) => item.status !== "OK").length,
  };
}

export type AmenitiesStockSummary = Awaited<
  ReturnType<typeof getAmenitiesStockSummary>
>;
