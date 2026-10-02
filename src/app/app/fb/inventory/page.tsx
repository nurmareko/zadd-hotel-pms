import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { InventoryIngredient } from "@/lib/fb/inventory-types";

import { InventoryView } from "./inventory-view";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "FB" && session.user.role !== "ADMIN") {
    redirect("/app/forbidden");
  }

  const ingredients = await prisma.fBIngredient.findMany({

    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      category: true,
      unit: true,
      onHand: true,
      parLevel: true,
      location: true,
      lastCountedAt: true,
      menuItem: { select: { id: true, name: true, isActive: true } },
    },
  });
  const items: InventoryIngredient[] = ingredients.map((item) => ({
    id: item.id,
    name: item.name,
    unit: item.unit,
    onHand: Number(item.onHand),
    parLevel: Number(item.parLevel),
    category: item.category,
    location: item.location,
    lastCountedAt: item.lastCountedAt?.toISOString() ?? null,
    menuItem: item.menuItem ? {
      id: item.menuItem.id, name: item.menuItem.name, isActive: item.menuItem.isActive,
    } : null,
  }));

  return <main className="min-h-screen bg-slate-50 p-4 text-foreground md:p-5 lg:p-6"><InventoryView ingredients={items} /></main>;
}
