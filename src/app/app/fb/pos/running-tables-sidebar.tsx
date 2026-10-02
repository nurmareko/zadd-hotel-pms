"use client";

import { useId, useState } from "react";
import type { FBOrderServiceType, TableLocation, TableStatus } from "@prisma/client";
import { BedDouble, Utensils } from "lucide-react";
import { selectActiveOrder } from "./pos-state";
import type { PosOrder, PosTable } from "./pos-types";

export type RunningTablesSidebarProps = {
  tables: PosTable[];
  orders: PosOrder[];
  activeOrderId: number | null;
  serviceType: FBOrderServiceType;
  disabled?: boolean;
  onSelectOrder: (id: number) => void;
  onSelectTable: (table: PosTable) => void;
  onServiceTypeChange: (serviceType: FBOrderServiceType) => void;
};

const locations: { value: TableLocation; label: string }[] = [
  { value: "INDOOR", label: "Dalam ruangan" },
  { value: "OUTDOOR", label: "Luar ruangan" },
  { value: "PRIVATE", label: "Ruang privat" },
];

const tableStatuses: Record<TableStatus, { label: string; className: string }> = {
  AVAILABLE: { label: "Tersedia", className: "bg-status-vc-bg text-status-vc-fg" },
  OCCUPIED: { label: "Terisi", className: "bg-status-oc-bg text-status-oc-fg" },
  RESERVED: { label: "Dipesan", className: "bg-status-vd-bg text-status-vd-fg" },
  OUT_OF_SERVICE: { label: "Tidak tersedia (OOS)", className: "bg-status-oos-bg text-status-oos-fg" },
};

const selectionClassName = "min-h-11 w-full rounded-md border border-border p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:border-ring aria-pressed:bg-accent";

export function RunningTablesSidebar({ tables, orders, activeOrderId, serviceType, disabled = false, onSelectOrder, onSelectTable, onServiceTypeChange }: RunningTablesSidebarProps) {
  const locationId = useId();
  const [location, setLocation] = useState("all");
  const activeOrder = selectActiveOrder(orders, activeOrderId);
  const runningOrders = orders.filter((order) => order.status === "OPEN" || order.status === "BILLED");
  const roomOrders = runningOrders.filter((order) => order.serviceType === "ROOM_SERVICE");

  return (
    <aside aria-label="Meja dan layanan kamar" className="min-w-0 space-y-5 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div>
        <h2 className="mb-3 text-base font-semibold">Layanan</h2>
        <div role="group" aria-label="Jenis layanan" className="grid grid-cols-2 gap-2">
          <button type="button" className={selectionClassName} disabled={disabled} aria-pressed={serviceType === "DINE_IN"} onClick={() => onServiceTypeChange("DINE_IN")}>
            <Utensils aria-hidden="true" className="mb-1 size-4" />
            <span className="text-sm font-medium">Meja Berjalan</span>
          </button>
          <button type="button" className={selectionClassName} disabled={disabled} aria-pressed={serviceType === "ROOM_SERVICE"} onClick={() => onServiceTypeChange("ROOM_SERVICE")}>
            <BedDouble aria-hidden="true" className="mb-1 size-4" />
            <span className="text-sm font-medium">Layanan Kamar / Antrean</span>
          </button>
        </div>
      </div>

      {serviceType === "DINE_IN" && (
        <section aria-label="Daftar meja" className="space-y-3">
          <h2 className="text-base font-semibold">Meja Berjalan</h2>
          <div className="space-y-1.5">
            <label htmlFor={locationId} className="block text-sm font-medium">Lokasi</label>
            <select id={locationId} value={location} disabled={disabled} onChange={(event) => setLocation(event.target.value)} className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
              <option value="all">Semua lokasi</option>
              {locations.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
          {tables.filter((table) => location === "all" || table.location === location).length === 0 && (
            <p className="text-sm text-muted-foreground">Belum ada meja di lokasi ini. Pilih lokasi lain atau hubungi admin.</p>
          )}
          {locations.filter((item) => location === "all" || item.value === location).map((item) => {
            const locationTables = tables.filter((table) => table.location === item.value);
            if (locationTables.length === 0) return null;
            return (
              <div key={item.value}>
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{item.label}</h3>
                <ul className="space-y-2">
                  {locationTables.map((table) => {
                    const tableOrder = activeOrder?.tableId === table.id ? activeOrder : runningOrders.find((order) => order.tableId === table.id);
                    const unavailable = table.status === "OUT_OF_SERVICE";
                    const occupied = table.status === "OCCUPIED" || Boolean(tableOrder);
                    const status = unavailable ? tableStatuses.OUT_OF_SERVICE : occupied ? tableStatuses.OCCUPIED : tableStatuses[table.status];
                    return (
                      <li key={table.id}>
                        <button
                          type="button"
                          className={selectionClassName}
                          disabled={disabled || unavailable || (occupied && !tableOrder)}
                          aria-pressed={Boolean(tableOrder && tableOrder.id === activeOrder?.id)}
                          onClick={() => { if (tableOrder) onSelectOrder(tableOrder.id); else onSelectTable(table); }}
                        >
                          <span className="flex flex-wrap items-center justify-between gap-2">
                            <span className="break-words text-sm font-semibold">Meja {table.number}</span>
                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${status.className}`}>{!unavailable && tableOrder?.status === "BILLED" ? "Ditagihkan" : status.label}</span>
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">{table.capacity} kursi{tableOrder ? ` · ${tableOrder.orderNo}` : ""}</span>
                          {table.status === "OCCUPIED" && !tableOrder && <span className="mt-1 block text-xs text-muted-foreground">Pesanan aktif tidak tersedia.</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>
      )}

      <section aria-label="Antrean layanan kamar" className="space-y-3">
        <h2 className="text-base font-semibold">Antrean layanan kamar <span className="text-sm font-normal text-muted-foreground">({roomOrders.length})</span></h2>
        {roomOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada pesanan layanan kamar. Buat pesanan baru untuk memulai.</p>
        ) : (
          <ul className="space-y-2">
            {roomOrders.map((order) => (
              <li key={order.id}>
                <button type="button" className={selectionClassName} disabled={disabled} aria-pressed={activeOrder?.id === order.id} onClick={() => onSelectOrder(order.id)}>
                  <span className="block break-words text-sm font-semibold">{order.destination}</span>
                  <span className="mt-1 block break-all text-xs text-muted-foreground">KOT · {order.orderNo}</span>
                  <span className="mt-2 inline-block rounded-full bg-status-oc-bg px-2 py-1 text-xs font-semibold text-status-oc-fg">{order.status === "BILLED" ? "Ditagihkan" : "Pesanan aktif"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
