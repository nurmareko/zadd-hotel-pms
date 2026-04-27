import { prisma } from "@/lib/prisma";
import { MenuTable } from "./menu-table";

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
    <main className="p-4 sm:p-6">
      <MenuTable
        items={menuItems.map((item) => ({
          ...item,
          price: item.price.toString(),
        }))}
      />
    </main>
  );
}
