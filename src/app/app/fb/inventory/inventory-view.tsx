"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Boxes, ClipboardCheck, History, MoreHorizontal, PackagePlus, RefreshCw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deriveInventoryStatus, type InventoryIngredient } from "@/lib/fb/inventory-types";
import { DisableMenuDialog, inventoryDate, LedgerDialog, operationLabels, quantityFormat, StockDialog, type StockOperation } from "./inventory-dialogs";

type Status = ReturnType<typeof deriveInventoryStatus>;
const statuses: { value: Status; label: string; color: string }[] = [
  { value: "NEGATIVE", label: "Negative", color: "bg-red-100 text-red-700" },
  { value: "OUT", label: "Out of Stock", color: "bg-orange-100 text-orange-800" },
  { value: "LOW", label: "Low", color: "bg-amber-100 text-amber-800" },
  { value: "OK", label: "Sufficient", color: "bg-green-100 text-green-800" },
];
const operations = [
  { value: "RECEIVE", icon: PackagePlus },
  { value: "STOCK_TAKE", icon: ClipboardCheck },
  { value: "WASTAGE", icon: Trash2 },
] as const;
type ActiveDialog = { type: "stock"; operation: StockOperation; ingredientId?: number }
  | { type: "ledger"; ingredient: InventoryIngredient }
  | { type: "disable"; menu: NonNullable<InventoryIngredient["menuItem"]> };

export function InventoryView({ ingredients }: { ingredients: InventoryIngredient[] }) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("all");
  const [status, setStatus] = useState<Status | "ALL">("ALL");
  const [dialog, setDialog] = useState<ActiveDialog | null>(null);

  const locations = [...new Set(ingredients.flatMap((item) => item.location ? [item.location] : []))].sort();
  const scoped = ingredients.filter((item) => (location === "all" || (location === "unset" ? !item.location : item.location === location.slice(6))) && `${item.name} ${item.category}`.toLocaleLowerCase("id-ID").includes(search.trim().toLocaleLowerCase("id-ID")));
  const visible = scoped.filter((item) => status === "ALL" || deriveInventoryStatus(item.onHand, item.parLevel) === status);
  const attention = scoped.filter((item) => item.onHand < 0 && item.menuItem);
  function refresh() { startTransition(() => router.refresh()); }
  function finish() { setDialog(null); refresh(); }
  function rowActions(item: InventoryIngredient) {
    return <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Actions for ${item.name}`} />}><MoreHorizontal aria-hidden="true" /></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {operations.map(({ value, icon: Icon }) => <DropdownMenuItem key={value} onClick={() => setDialog({ type: "stock", operation: value, ingredientId: item.id })}><Icon aria-hidden="true" />{operationLabels[value]}</DropdownMenuItem>)}
        <DropdownMenuItem onClick={() => setDialog({ type: "ledger", ingredient: item })}><History aria-hidden="true" />Stock History</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>;
  }

  return <div className="space-y-4 lg:space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl"><Boxes className="size-7 shrink-0" aria-hidden="true" />Kitchen Inventory</h1><p className="mt-2 text-sm text-muted-foreground">Track ingredient stock, receipts and physical counts.</p></div>
      <Button variant="outline" disabled={refreshing} onClick={refresh}><RefreshCw aria-hidden="true" className={refreshing ? "animate-spin" : ""} />{refreshing ? "Refreshing…" : "Refresh"}</Button>
    </header>
    <section aria-label="Inventory filters and actions" className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1 space-y-2 sm:min-w-56"><label htmlFor="inventory-search" className="text-sm font-medium">Search Ingredients</label><div className="relative"><Search aria-hidden="true" className="absolute top-3 left-3 size-4 text-muted-foreground" /><Input id="inventory-search" type="search" className="pl-9" placeholder="Ingredient name or category" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
      <div className="w-full space-y-2 sm:w-auto"><label htmlFor="inventory-location" className="text-sm font-medium">Storage Location</label><select id="inventory-location" value={location} onChange={(event) => setLocation(event.target.value)} className="block h-11 w-full rounded-md border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring desktop:h-10"><option value="all">All locations</option>{locations.map((name) => <option key={name} value={`place:${name}`}>{name}</option>)}{ingredients.some((item) => !item.location) && <option value="unset">Not specified</option>}</select></div>
      <div className="flex w-full flex-wrap gap-2 xl:w-auto">{operations.map(({ value, icon: Icon }) => <Button key={value} variant={value === "RECEIVE" ? "default" : "outline"} disabled={!ingredients.length || refreshing} onClick={() => setDialog({ type: "stock", operation: value })}><Icon aria-hidden="true" />{operationLabels[value]}</Button>)}</div>
    </section>
    {attention.length > 0 && <section aria-labelledby="inventory-attention" className="rounded-lg border border-amber-200 bg-amber-50 p-4 md:p-5">
      <h2 id="inventory-attention" className="flex items-center gap-2 font-semibold text-amber-900"><AlertTriangle className="size-5" aria-hidden="true" />Requires Attention</h2>
      <p className="mt-1 text-sm text-amber-900">Ingredients linked to menu items have negative stock. Check physical stock or disable the menu items (86).</p>
      <ul className="mt-3 divide-y divide-amber-200">{attention.map((item) => {
        const menu = item.menuItem!;
        const inactive = !menu.isActive;
        return <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="break-words text-sm font-semibold">{item.name} <span className="tabular-nums text-red-700">({quantityFormat.format(item.onHand)} {item.unit})</span></p><p className="break-words text-sm text-amber-900">Menu: {menu.name}</p></div><Button variant="outline" disabled={inactive || refreshing} onClick={() => setDialog({ type: "disable", menu })} aria-label={inactive ? `${menu.name} already inactive` : `Disable ${menu.name} (86)`}>{inactive ? "Menu Item Already Inactive" : "Disable Menu Item (86)"}</Button></li>;
      })}</ul>
    </section>}
    <section className="overflow-hidden rounded-lg border bg-white shadow-sm" aria-label="Ingredient list" aria-busy={refreshing}>
      <div className="flex flex-wrap gap-2 border-b p-4" aria-label="Stock status filter">
        <Button size="sm" variant={status === "ALL" ? "default" : "outline"} aria-pressed={status === "ALL"} onClick={() => setStatus("ALL")}>All <span className="tabular-nums">{scoped.length}</span></Button>
        {statuses.map((item) => <Button key={item.value} size="sm" variant={status === item.value ? "default" : "outline"} aria-pressed={status === item.value} onClick={() => setStatus(item.value)}>{item.label}<span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${item.color}`}>{scoped.filter((ingredient) => deriveInventoryStatus(ingredient.onHand, ingredient.parLevel) === item.value).length}</span></Button>)}
      </div>
      <p role="status" className="px-4 pt-3 text-xs text-muted-foreground">{visible.length} ingredients shown · Times in WIB</p>
      {visible.length === 0 ? <div className="space-y-2 px-4 py-12 text-center"><Boxes className="mx-auto size-8 text-muted-foreground" aria-hidden="true" /><h2 className="font-semibold">{ingredients.length ? "No matching ingredients" : "No ingredients yet"}</h2><p className="text-sm text-muted-foreground">{ingredients.length ? "Change your search or filters to see other ingredients." : "Contact an administrator to set up ingredients."}</p>{ingredients.length > 0 && <Button variant="outline" onClick={() => { setSearch(""); setLocation("all"); setStatus("ALL"); }}>Reset Filters</Button>}</div>
        : <table className="block w-full text-sm lg:table"><caption className="sr-only">Kitchen ingredient stock</caption><thead className="hidden bg-slate-50 text-xs text-muted-foreground lg:table-header-group"><tr>{["Ingredients", "Category", "Physical Stock", "Par", "Status", "Last Counted", "Actions"].map((label) => <th key={label} scope="col" className={`px-4 py-3 font-medium ${label === "Physical Stock" || label === "Par" ? "text-right" : "text-left"}`}>{label}</th>)}</tr></thead>
          <tbody className="block divide-y lg:table-row-group">{visible.map((item) => {
            const state = statuses.find((entry) => entry.value === deriveInventoryStatus(item.onHand, item.parLevel))!;
            return <tr key={item.id} className="grid grid-cols-2 items-center gap-3 p-4 lg:table-row lg:p-0">
              <th scope="row" className="col-span-2 min-w-0 text-left font-semibold lg:px-4 lg:py-3"><span className="break-words">{item.name}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{item.location ?? "Location not specified"}</span></th>
              <td className="lg:px-4 lg:py-3"><span className="block text-xs text-muted-foreground lg:hidden">Category</span>{item.category}</td>
              <td className="text-right tabular-nums lg:px-4 lg:py-3"><span className="block text-xs text-muted-foreground lg:hidden">Physical Stock</span><span className={item.onHand < 0 ? "font-semibold text-red-700" : "font-semibold"}>{quantityFormat.format(item.onHand)} {item.unit}</span></td>
              <td className="tabular-nums lg:px-4 lg:py-3 lg:text-right"><span className="block text-xs text-muted-foreground lg:hidden">Par</span>{quantityFormat.format(item.parLevel)} {item.unit}</td>
              <td className="text-right lg:px-4 lg:py-3 lg:text-left"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${state.color}`}>{state.label}</span></td>
              <td className="text-xs text-muted-foreground lg:px-4 lg:py-3"><span className="block lg:hidden">Last Counted</span>{inventoryDate(item.lastCountedAt)}</td>
              <td className="text-right lg:px-4 lg:py-3 lg:text-left">{rowActions(item)}</td>
            </tr>;
          })}</tbody>
        </table>}
    </section>
    {dialog?.type === "stock" && <StockDialog operation={dialog.operation} initialId={dialog.ingredientId} ingredients={ingredients} onClose={() => setDialog(null)} onSuccess={finish} />}
    {dialog?.type === "ledger" && <LedgerDialog key={dialog.ingredient.id} ingredient={dialog.ingredient} onClose={() => setDialog(null)} />}
    {dialog?.type === "disable" && <DisableMenuDialog menu={dialog.menu} onClose={() => setDialog(null)} onSuccess={finish} />}
  </div>;
}
