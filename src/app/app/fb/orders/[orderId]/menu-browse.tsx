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
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="text-base font-semibold text-slate-900">
          Pilih Menu
        </div>
        <div className="relative w-full md:max-w-[240px]">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
          />
          <input
            className="h-10 w-full rounded-md border border-gray-300 bg-white py-1 pl-9 pr-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari menu..."
            type="search"
            value={query}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-gray-200 px-5 py-3">
        <div className="mr-1 flex items-center text-sm font-semibold text-slate-600">
          Tamu
        </div>
        {guestNumbers.map((guestNumber) => {
          const active = activeGuest === guestNumber;

          return (
            <button
              className={`h-8 rounded-full border px-3 text-xs font-semibold transition-colors ${
                active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-gray-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
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
      <div className="flex flex-wrap gap-4 border-b border-gray-200 px-5 py-3">
        {categoryTabs.map((category) => {
          const active = activeCategory === category;

          return (
            <button
              className={`border-b-2 pb-2 text-sm font-semibold transition-colors ${
                active
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-900"
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
        <div className="grid gap-3 p-4 sm:grid-cols-2 2xl:grid-cols-3">
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
