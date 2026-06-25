import { TableLocation, TableStatus } from "@prisma/client";
import { Table2 } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";

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
  const scaleStyle = {
    "--floor-plan-scale": `min(1, calc(100cqw / ${RESTAURANT_FLOOR_CANVAS_WIDTH}px))`,
  } as CSSProperties;

  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-4 md:px-5">
        <nav className="flex gap-5" aria-label="Lokasi meja">
          {locationTabs.map((location) => (
            <Link
              key={location}
              className={`border-b-2 px-0 py-3 text-sm font-semibold capitalize transition-colors ${
                selectedLocation === location
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-900"
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

      <div className="flex flex-col gap-3 border-b border-gray-200 p-4 md:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Floor Plan
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            <span className="num">{RESTAURANT_FLOOR_CANVAS_WIDTH}</span>x
            <span className="num">{RESTAURANT_FLOOR_CANVAS_HEIGHT}</span> px ·{" "}
            <span className="num">{selectedTables.length}</span> meja
          </p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Legenda status meja">
          {statusLegendItems.map((status) => (
            <div
              key={status}
              className={`inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold ${floorTableStatusStyles[status]}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
              {tableStatusLabels[status]}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-full overflow-hidden p-4 [container-type:inline-size] md:p-5">
        <div
          className="relative w-full"
          style={{
            ...scaleStyle,
            maxWidth: RESTAURANT_FLOOR_CANVAS_WIDTH,
            height: `calc(${RESTAURANT_FLOOR_CANVAS_HEIGHT}px * var(--floor-plan-scale))`,
          }}
        >
          <div
            className="absolute left-0 top-0 origin-top-left rounded-lg border border-gray-200 bg-slate-50 shadow-inner"
            style={{
              width: RESTAURANT_FLOOR_CANVAS_WIDTH,
              height: RESTAURANT_FLOOR_CANVAS_HEIGHT,
              transform: "scale(var(--floor-plan-scale))",
            }}
          >
            {selectedTables.length === 0 ? (
              <div className="absolute left-4 top-4 max-w-xs rounded-lg border border-dashed border-gray-200 bg-white px-4 py-3 text-left shadow-sm">
                <Table2 className="h-5 w-5 text-slate-400" aria-hidden="true" />
                <h3 className="mt-3 text-sm font-semibold text-slate-900">
                  Belum ada meja di area ini
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Pilih area lain atau tambahkan meja dari admin.
                </p>
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
      </div>
    </section>
  );
}
