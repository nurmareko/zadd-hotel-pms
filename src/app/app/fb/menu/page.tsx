import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { canAccessModule } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { MenuTable } from "./menu-table";

export const dynamic = "force-dynamic";

export default async function FbMenuPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canAccessModule(session.user.role, "food_and_beverage")) {
    redirect("/app/forbidden");
  }

  const menuItems = await prisma.menuItem.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      category: true,
      price: true,
      isActive: true,
    },
  });

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-4 text-foreground md:px-6 md:py-5">
      <MenuTable
        items={menuItems.map((item) => ({
          ...item,
          price: item.price.toString(),
        }))}
      />
    </main>
  );
}
