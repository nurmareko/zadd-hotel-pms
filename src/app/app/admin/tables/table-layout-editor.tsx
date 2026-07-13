"use client";

import { TableLocation } from "@prisma/client";
import { RotateCcw, Table2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Rnd } from "react-rnd";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  RESTAURANT_FLOOR_CANVAS_HEIGHT,
  RESTAURANT_FLOOR_CANVAS_WIDTH,
  RESTAURANT_TABLE_BOX_SIZE,
  RESTAURANT_TABLE_DRAG_GRID,
  clampRestaurantTablePosition,
} from "@/lib/restaurant-table-layout";
import {
  autoArrangeRestaurantTables,
  updateRestaurantTablePosition,
} from "./actions";

type LayoutTable = {
  id: number;
  number: string;
  capacity: number;
  location: TableLocation;
  posX: number;
  posY: number;
};

type TableLayoutEditorProps = {
  tables: LayoutTable[];
};

type PositionOverrides = Record<number, { posX: number; posY: number }>;

const tableBoxClassName =
  "flex h-full w-full cursor-move select-none flex-col items-center justify-center rounded-md border border-gray-200 bg-white text-slate-900 shadow-sm transition-shadow hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2";

const locationTabs = Object.values(TableLocation);

function locationLabel(location: TableLocation) {
  return location.replaceAll("_", " ").toLowerCase();
}

export function RestaurantTableLayoutEditor({
  tables,
}: TableLayoutEditorProps) {
  const [positionOverrides, setPositionOverrides] = useState<PositionOverrides>(
    {},
  );
  const [selectedLocation, setSelectedLocation] = useState<TableLocation>(
    locationTabs[0],
  );
  const [savingTableId, setSavingTableId] = useState<number | null>(null);
  const [isArranging, startArrangeTransition] = useTransition();
  const layoutTables = tables.map((table) => ({
    ...table,
    ...positionOverrides[table.id],
  }));
  const selectedTables = layoutTables.filter(
    (table) => table.location === selectedLocation,
  );

  async function handleDragStop(table: LayoutTable, posX: number, posY: number) {
    const previousPosition = { posX: table.posX, posY: table.posY };
    const nextPosition = clampRestaurantTablePosition({ posX, posY });

    setPositionOverrides((currentOverrides) => ({
      ...currentOverrides,
      [table.id]: nextPosition,
    }));
    setSavingTableId(table.id);

    const result = await updateRestaurantTablePosition({
      id: table.id,
      ...nextPosition,
    });

    setSavingTableId(null);

    if (result.ok) {
      return;
    }

    setPositionOverrides((currentOverrides) => ({
      ...currentOverrides,
      [table.id]: previousPosition,
    }));
    toast.error(result.error);
  }

  function handleAutoArrange() {
    startArrangeTransition(async () => {
      const result = await autoArrangeRestaurantTables({
        location: selectedLocation,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setPositionOverrides((currentOverrides) => {
        const nextOverrides = { ...currentOverrides };

        for (const table of result.tables) {
          nextOverrides[table.id] = { posX: table.posX, posY: table.posY };
        }

        return nextOverrides;
      });
      toast.success("Lokasi tersusun otomatis");
    });
  }

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-gray-200 p-4 md:flex-row md:items-center md:justify-between md:p-5">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Floor Layout
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            <span className="num">{RESTAURANT_FLOOR_CANVAS_WIDTH}</span>x
            <span className="num">{RESTAURANT_FLOOR_CANVAS_HEIGHT}</span> px ·{" "}
            <span className="num">{selectedTables.length}</span> meja
          </p>
        </div>
        <Button
          type="button"
          disabled={isArranging}
          onClick={handleAutoArrange}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          {isArranging ? "Arranging..." : "Auto-arrange"}
        </Button>
      </div>

      <div className="border-b border-gray-200 px-4 py-3 md:px-5">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Lokasi meja">
          {locationTabs.map((location) => (
            <button
              key={location}
              type="button"
              className={`rounded-md px-3 py-2 text-sm font-semibold capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
                selectedLocation === location
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
              role="tab"
              aria-selected={selectedLocation === location}
              onClick={() => setSelectedLocation(location)}
            >
              {locationLabel(location)}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-auto p-4 md:p-5">
        <div
          className="relative rounded-lg border border-gray-200 bg-slate-50 shadow-inner"
          style={{
            width: RESTAURANT_FLOOR_CANVAS_WIDTH,
            height: RESTAURANT_FLOOR_CANVAS_HEIGHT,
          }}
        >
          {selectedTables.length === 0 ? (
            <div className="absolute left-4 top-4 max-w-xs rounded-lg border border-gray-200 bg-white px-4 py-3 text-left shadow-sm">
              <Table2 className="h-5 w-5 text-slate-400" aria-hidden="true" />
              <h3 className="mt-3 text-sm font-semibold text-slate-900">
                Belum ada meja di area ini
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Pindahkan atau tambahkan meja untuk mengatur layout area ini.
              </p>
            </div>
          ) : null}

          {selectedTables.map((table) => (
            <Rnd
              key={table.id}
              bounds="parent"
              dragGrid={[RESTAURANT_TABLE_DRAG_GRID, RESTAURANT_TABLE_DRAG_GRID]}
              enableResizing={false}
              position={{ x: table.posX, y: table.posY }}
              size={{
                width: RESTAURANT_TABLE_BOX_SIZE,
                height: RESTAURANT_TABLE_BOX_SIZE,
              }}
              onDragStop={(_event, data) => {
                void handleDragStop(table, data.x, data.y);
              }}
            >
              <button
                type="button"
                className={tableBoxClassName}
                aria-label={`Table ${table.number}, capacity ${table.capacity}`}
              >
                <span className="num text-[17px] font-bold leading-none">
                  {table.number}
                </span>
                <span className="mt-1 text-[10px] font-semibold text-slate-500">
                  {table.capacity} pax
                </span>
                {savingTableId === table.id ? (
                  <span className="mt-1 text-[9px] font-semibold text-slate-500">
                    Saving
                  </span>
                ) : null}
              </button>
            </Rnd>
          ))}
        </div>
      </div>
    </section>
  );
}
