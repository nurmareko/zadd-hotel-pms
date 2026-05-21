"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { MenuItemCard } from "./menu-item-card";

export type MenuBrowseItem = {
  id: number;
  name: string;
  category: string;
  price: string;
};

type MenuBrowseProps = {
  menuItems: MenuBrowseItem[];
  orderId: number;
  orderStatus: string;
};

const categoryTabs = ["Mains", "Drinks", "Desserts", "Breakfast", "All"];

export function MenuBrowse({
  menuItems,
  orderId,
  orderStatus,
}: MenuBrowseProps) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [query, setQuery] = useState("");
  const canEdit = orderStatus === "OPEN";
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return menuItems.filter((item) => {
      const matchesCategory =
        activeCategory === "All" || item.category === activeCategory;
      const matchesQuery = normalizedQuery
        ? item.name.toLowerCase().includes(normalizedQuery)
        : true;

      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, menuItems, query]);

  return (
    <section className="border border-console-border bg-console-surface">
      <div className="flex flex-col gap-3 border-b border-console-border bg-console-ink px-3.5 py-2 md:flex-row md:items-center md:justify-between">
        <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
          {"// PILIH MENU"}
        </div>
        <div className="relative w-full md:max-w-[240px]">
          <Search
            aria-hidden="true"
            className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-slate-400"
          />
          <input
            className="h-8 w-full border border-slate-600 bg-white py-1 pl-7 pr-2 text-[12px] text-console-ink outline-none placeholder:text-slate-400 focus:border-console-accent"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari menu..."
            type="search"
            value={query}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-3 border-b border-console-border px-3.5 py-3">
        {categoryTabs.map((category) => {
          const active = activeCategory === category;

          return (
            <button
              className={`border-b-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] ${
                active
                  ? "border-console-ink text-console-ink"
                  : "border-transparent text-slate-500 hover:text-console-ink"
              }`}
              key={category}
              onClick={() => setActiveCategory(category)}
              type="button"
            >
              {category}
            </button>
          );
        })}
      </div>
      {filteredItems.length === 0 ? (
        <div className="p-8 text-center text-[12px] text-slate-500">
          Tidak ada menu yang cocok.
        </div>
      ) : (
        <div className="grid gap-2.5 p-3.5 sm:grid-cols-2 2xl:grid-cols-3">
          {filteredItems.map((item) => (
            <MenuItemCard
              item={item}
              key={item.id}
              orderId={orderId}
              disabled={!canEdit}
            />
          ))}
        </div>
      )}
    </section>
  );
}
