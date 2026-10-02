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
  { value: "NEGATIVE", label: "Negatif", color: "bg-red-100 text-red-700" },
  { value: "OUT", label: "Habis", color: "bg-orange-100 text-orange-800" },
  { value: "LOW", label: "Rendah", color: "bg-amber-100 text-amber-800" },
  { value: "OK", label: "Aman", color: "bg-green-100 text-green-800" },
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
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Aksi untuk ${item.name}`} />}><MoreHorizontal aria-hidden="true" /></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {operations.map(({ value, icon: Icon }) => <DropdownMenuItem key={value} onClick={() => setDialog({ type: "stock", operation: value, ingredientId: item.id })}><Icon aria-hidden="true" />{operationLabels[value]}</DropdownMenuItem>)}
        <DropdownMenuItem onClick={() => setDialog({ type: "ledger", ingredient: item })}><History aria-hidden="true" />Riwayat Stok</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>;
  }

  return <div className="space-y-4 lg:space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl"><Boxes className="size-7 shrink-0" aria-hidden="true" />Inventaris Dapur</h1><p className="mt-2 text-sm text-muted-foreground">Pantau stok bahan baku, penerimaan, dan hasil penghitungan fisik.</p></div>
      <Button variant="outline" disabled={refreshing} onClick={refresh}><RefreshCw aria-hidden="true" className={refreshing ? "animate-spin" : ""} />{refreshing ? "Memuat Ulang…" : "Muat Ulang"}</Button>
    </header>
    <section aria-label="Filter dan tindakan inventaris" className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1 space-y-2 sm:min-w-56"><label htmlFor="inventory-search" className="text-sm font-medium">Cari Bahan Baku</label><div className="relative"><Search aria-hidden="true" className="absolute top-3 left-3 size-4 text-muted-foreground" /><Input id="inventory-search" type="search" className="pl-9" placeholder="Nama bahan atau kategori" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
      <div className="w-full space-y-2 sm:w-auto"><label htmlFor="inventory-location" className="text-sm font-medium">Lokasi Penyimpanan</label><select id="inventory-location" value={location} onChange={(event) => setLocation(event.target.value)} className="block h-11 w-full rounded-md border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring desktop:h-10"><option value="all">Semua lokasi</option>{locations.map((name) => <option key={name} value={`place:${name}`}>{name}</option>)}{ingredients.some((item) => !item.location) && <option value="unset">Belum ditentukan</option>}</select></div>
      <div className="flex w-full flex-wrap gap-2 xl:w-auto">{operations.map(({ value, icon: Icon }) => <Button key={value} variant={value === "RECEIVE" ? "default" : "outline"} disabled={!ingredients.length || refreshing} onClick={() => setDialog({ type: "stock", operation: value })}><Icon aria-hidden="true" />{operationLabels[value]}</Button>)}</div>
    </section>
    {attention.length > 0 && <section aria-labelledby="inventory-attention" className="rounded-lg border border-amber-200 bg-amber-50 p-4 md:p-5">
      <h2 id="inventory-attention" className="flex items-center gap-2 font-semibold text-amber-900"><AlertTriangle className="size-5" aria-hidden="true" />Perlu Perhatian</h2>
      <p className="mt-1 text-sm text-amber-900">Stok negatif ditemukan pada bahan yang terhubung ke menu. Periksa stok fisik atau nonaktifkan menu (86).</p>
      <ul className="mt-3 divide-y divide-amber-200">{attention.map((item) => {
        const menu = item.menuItem!;
        const inactive = !menu.isActive;
        return <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="break-words text-sm font-semibold">{item.name} <span className="tabular-nums text-red-700">({quantityFormat.format(item.onHand)} {item.unit})</span></p><p className="break-words text-sm text-amber-900">Menu: {menu.name}</p></div><Button variant="outline" disabled={inactive || refreshing} onClick={() => setDialog({ type: "disable", menu })} aria-label={inactive ? `${menu.name} sudah nonaktif` : `Nonaktifkan ${menu.name} (86)`}>{inactive ? "Menu Sudah Nonaktif" : "Nonaktifkan Menu (86)"}</Button></li>;
      })}</ul>
    </section>}
    <section className="overflow-hidden rounded-lg border bg-white shadow-sm" aria-label="Daftar bahan baku" aria-busy={refreshing}>
      <div className="flex flex-wrap gap-2 border-b p-4" aria-label="Filter status stok">
        <Button size="sm" variant={status === "ALL" ? "default" : "outline"} aria-pressed={status === "ALL"} onClick={() => setStatus("ALL")}>Semua <span className="tabular-nums">{scoped.length}</span></Button>
        {statuses.map((item) => <Button key={item.value} size="sm" variant={status === item.value ? "default" : "outline"} aria-pressed={status === item.value} onClick={() => setStatus(item.value)}>{item.label}<span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${item.color}`}>{scoped.filter((ingredient) => deriveInventoryStatus(ingredient.onHand, ingredient.parLevel) === item.value).length}</span></Button>)}
      </div>
      <p role="status" className="px-4 pt-3 text-xs text-muted-foreground">{visible.length} bahan ditampilkan · Waktu dalam WIB</p>
      {visible.length === 0 ? <div className="space-y-2 px-4 py-12 text-center"><Boxes className="mx-auto size-8 text-muted-foreground" aria-hidden="true" /><h2 className="font-semibold">{ingredients.length ? "Tidak ada bahan yang cocok" : "Belum ada bahan baku"}</h2><p className="text-sm text-muted-foreground">{ingredients.length ? "Ubah pencarian atau filter untuk melihat bahan lainnya." : "Hubungi administrator untuk menyiapkan data bahan baku."}</p>{ingredients.length > 0 && <Button variant="outline" onClick={() => { setSearch(""); setLocation("all"); setStatus("ALL"); }}>Atur Ulang Filter</Button>}</div>
        : <table className="block w-full text-sm lg:table"><caption className="sr-only">Stok bahan baku dapur</caption><thead className="hidden bg-slate-50 text-xs text-muted-foreground lg:table-header-group"><tr>{["Bahan Baku", "Kategori", "Stok Fisik", "Par", "Status", "Terakhir Dihitung", "Aksi"].map((label) => <th key={label} scope="col" className={`px-4 py-3 font-medium ${label === "Stok Fisik" || label === "Par" ? "text-right" : "text-left"}`}>{label}</th>)}</tr></thead>
          <tbody className="block divide-y lg:table-row-group">{visible.map((item) => {
            const state = statuses.find((entry) => entry.value === deriveInventoryStatus(item.onHand, item.parLevel))!;
            return <tr key={item.id} className="grid grid-cols-2 items-center gap-3 p-4 lg:table-row lg:p-0">
              <th scope="row" className="col-span-2 min-w-0 text-left font-semibold lg:px-4 lg:py-3"><span className="break-words">{item.name}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{item.location ?? "Lokasi belum ditentukan"}</span></th>
              <td className="lg:px-4 lg:py-3"><span className="block text-xs text-muted-foreground lg:hidden">Kategori</span>{item.category}</td>
              <td className="text-right tabular-nums lg:px-4 lg:py-3"><span className="block text-xs text-muted-foreground lg:hidden">Stok Fisik</span><span className={item.onHand < 0 ? "font-semibold text-red-700" : "font-semibold"}>{quantityFormat.format(item.onHand)} {item.unit}</span></td>
              <td className="tabular-nums lg:px-4 lg:py-3 lg:text-right"><span className="block text-xs text-muted-foreground lg:hidden">Par</span>{quantityFormat.format(item.parLevel)} {item.unit}</td>
              <td className="text-right lg:px-4 lg:py-3 lg:text-left"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${state.color}`}>{state.label}</span></td>
              <td className="text-xs text-muted-foreground lg:px-4 lg:py-3"><span className="block lg:hidden">Terakhir Dihitung</span>{inventoryDate(item.lastCountedAt)}</td>
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
