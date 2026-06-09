"use client";

import { Search, SearchX, Utensils } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
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
  guestCount: number;
};

const categoryTabs = ["Mains", "Beverage", "Desserts", "Breakfast", "All"];

export function MenuBrowse({
  menuItems,
  orderId,
  orderStatus,
  guestCount,
}: MenuBrowseProps) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeGuest, setActiveGuest] = useState(1);
  const [query, setQuery] = useState("");
  const canEdit = orderStatus === "OPEN";
  const guestNumbers = useMemo(
    () => Array.from({ length: Math.max(guestCount, 1) }, (_, index) => index + 1),
    [guestCount],
  );
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
          {"PILIH MENU"}
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
        <div className="mr-1 flex items-center text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
          Tamu
        </div>
        {guestNumbers.map((guestNumber) => {
          const active = activeGuest === guestNumber;

          return (
            <button
              className={`h-7 border px-2 text-[11px] font-semibold uppercase tracking-[0.04em] ${
                active
                  ? "border-console-ink bg-console-ink text-console-accent"
                  : "border-console-border bg-white text-console-ink hover:border-console-ink hover:bg-console-bg"
              }`}
              key={guestNumber}
              onClick={() => setActiveGuest(guestNumber)}
              type="button"
            >
              {guestNumber}
            </button>
          );
        })}
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
        <EmptyState
          icon={menuItems.length === 0 ? Utensils : SearchX}
          title={menuItems.length === 0 ? "Belum ada menu" : "Tidak ada menu"}
          description={
            menuItems.length === 0
              ? "Menu aktif akan muncul di sini setelah dibuat oleh admin."
              : "Tidak ada menu yang cocok dengan filter atau pencarian."
          }
          className="m-3.5"
        />
      ) : (
        <div className="grid gap-2.5 p-3.5 sm:grid-cols-2 2xl:grid-cols-3">
          {filteredItems.map((item) => (
            <MenuItemCard
              item={item}
              key={item.id}
              orderId={orderId}
              guestNumber={activeGuest}
              disabled={!canEdit}
            />
          ))}
        </div>
      )}
    </section>
  );
}
