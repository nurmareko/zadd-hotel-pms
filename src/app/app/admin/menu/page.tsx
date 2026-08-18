import { prisma } from "@/lib/prisma";
import { MenuTable } from "./menu-table";

export const dynamic = "force-dynamic";

export default async function FbMenuPage() {
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
