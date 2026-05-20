import { TableLocation } from "@prisma/client";

import { TableCard, type RestaurantTableCard } from "./table-card";

type FloorPlanProps = {
  tables: RestaurantTableCard[];
};

const locationLabels: Record<TableLocation, string> = {
  INDOOR: "// INDOOR",
  OUTDOOR: "// OUTDOOR",
  PRIVATE: "// PRIVATE ROOM",
};

const locationOrder: TableLocation[] = [
  TableLocation.INDOOR,
  TableLocation.OUTDOOR,
  TableLocation.PRIVATE,
];

function byTableNumber(first: RestaurantTableCard, second: RestaurantTableCard) {
  return first.number.localeCompare(second.number, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function FloorPlan({ tables }: FloorPlanProps) {
  if (tables.length === 0) {
    return (
      <section className="border border-dashed border-console-border bg-console-surface p-8 text-center text-[12px] text-slate-500">
        Belum ada meja terdaftar
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {locationOrder.map((location) => {
        const locationTables = tables
          .filter((table) => table.location === location)
          .sort(byTableNumber);

        if (locationTables.length === 0) {
          return null;
        }

        return (
          <section key={location} className="border border-console-border bg-console-surface">
            <div className="border-b border-console-border bg-console-ink px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
              {locationLabels[location]}
            </div>
            <div className="grid gap-2.5 p-3.5 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
              {locationTables.map((table) => (
                <TableCard key={table.id} table={table} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
