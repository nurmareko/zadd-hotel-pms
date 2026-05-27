import { TableLocation, TableStatus } from "@prisma/client";
import Link from "next/link";

import {
  RESTAURANT_FLOOR_CANVAS_HEIGHT,
  RESTAURANT_FLOOR_CANVAS_WIDTH,
  RESTAURANT_TABLE_BOX_SIZE,
  clampRestaurantTablePosition,
} from "@/lib/restaurant-table-layout";
import {
  TableCard,
  floorTableStatusStyles,
  type RestaurantTableCard,
} from "./table-card";
import { tableStatusLabels } from "./status-badge";

type FloorPlanProps = {
  selectedLocation: TableLocation;
  tables: RestaurantTableCard[];
};

const locationTabs = Object.values(TableLocation);
const statusLegendItems = Object.values(TableStatus);

function locationLabel(location: TableLocation) {
  return location.replaceAll("_", " ").toLowerCase();
}

function byTableNumber(first: RestaurantTableCard, second: RestaurantTableCard) {
  return first.number.localeCompare(second.number, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function FloorPlan({ selectedLocation, tables }: FloorPlanProps) {
  const selectedTables = tables
    .filter((table) => table.location === selectedLocation)
    .toSorted(byTableNumber);

  return (
    <section className="border border-console-border bg-console-surface">
      <div className="border-b border-console-border px-3.5">
        <nav className="flex gap-5" aria-label="Table location">
          {locationTabs.map((location) => (
            <Link
              key={location}
              className={`border-b-2 px-0 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] ${
                selectedLocation === location
                  ? "border-console-ink text-console-ink"
                  : "border-transparent text-slate-500 hover:text-console-ink"
              }`}
              href={
                location === locationTabs[0]
                  ? "/app/fb"
                  : `/app/fb?location=${location}`
              }
            >
              {locationLabel(location)}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex flex-col gap-3 border-b border-console-border p-3.5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-console-ink">
            Floor Plan
          </h2>
          <p className="mt-1 text-[11px] text-slate-500">
            <span className="num">{RESTAURANT_FLOOR_CANVAS_WIDTH}</span>x
            <span className="num">{RESTAURANT_FLOOR_CANVAS_HEIGHT}</span> px ·{" "}
            <span className="num">{selectedTables.length}</span> meja
          </p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Table status legend">
          {statusLegendItems.map((status) => (
            <div
              key={status}
              className={`inline-flex h-6 items-center gap-1.5 border px-2 text-[10px] font-semibold uppercase tracking-[0.06em] ${floorTableStatusStyles[status]}`}
            >
              <span className="h-1.5 w-1.5 bg-current" aria-hidden="true" />
              {tableStatusLabels[status]}
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-auto p-3.5">
        <div
          className="relative border border-dashed border-console-border bg-console-bg"
          style={{
            width: RESTAURANT_FLOOR_CANVAS_WIDTH,
            height: RESTAURANT_FLOOR_CANVAS_HEIGHT,
          }}
        >
          {selectedTables.length === 0 ? (
            <div className="absolute left-4 top-4 border border-dashed border-console-border bg-console-surface px-3 py-2 text-[11px] text-slate-500">
              No tables in this area.
            </div>
          ) : null}

          {selectedTables.map((table) => {
            const position = clampRestaurantTablePosition({
              posX: table.posX,
              posY: table.posY,
            });

            return (
              <div
                key={table.id}
                className="absolute"
                style={{
                  left: position.posX,
                  top: position.posY,
                  width: RESTAURANT_TABLE_BOX_SIZE,
                  height: RESTAURANT_TABLE_BOX_SIZE,
                }}
              >
                <TableCard table={table} variant="floor" />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
