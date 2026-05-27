"use client";

import { RotateCcw } from "lucide-react";
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
  posX: number;
  posY: number;
};

type TableLayoutEditorProps = {
  tables: LayoutTable[];
};

const tableBoxClassName =
  "flex h-full w-full cursor-move select-none flex-col items-center justify-center border border-console-ink bg-console-surface text-console-ink shadow-[2px_2px_0_#111827] focus-within:outline-none";

export function RestaurantTableLayoutEditor({
  tables,
}: TableLayoutEditorProps) {
  const [layoutTables, setLayoutTables] = useState(tables);
  const [savingTableId, setSavingTableId] = useState<number | null>(null);
  const [isArranging, startArrangeTransition] = useTransition();

  async function handleDragStop(table: LayoutTable, posX: number, posY: number) {
    const previousPosition = { posX: table.posX, posY: table.posY };
    const nextPosition = clampRestaurantTablePosition({ posX, posY });

    setLayoutTables((currentTables) =>
      currentTables.map((currentTable) =>
        currentTable.id === table.id
          ? { ...currentTable, ...nextPosition }
          : currentTable,
      ),
    );
    setSavingTableId(table.id);

    const result = await updateRestaurantTablePosition({
      id: table.id,
      ...nextPosition,
    });

    setSavingTableId(null);

    if (result.ok) {
      return;
    }

    setLayoutTables((currentTables) =>
      currentTables.map((currentTable) =>
        currentTable.id === table.id
          ? { ...currentTable, ...previousPosition }
          : currentTable,
      ),
    );
    toast.error(result.error);
  }

  function handleAutoArrange() {
    startArrangeTransition(async () => {
      const result = await autoArrangeRestaurantTables();

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setLayoutTables((currentTables) =>
        currentTables.map((table) => {
          const arrangedTable = result.tables.find(
            (position) => position.id === table.id,
          );

          return arrangedTable ? { ...table, ...arrangedTable } : table;
        }),
      );
      toast.success("Layout auto-arranged");
    });
  }

  return (
    <section className="border border-console-border bg-console-surface">
      <div className="flex flex-col gap-3 border-b border-console-border bg-console-surface p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-console-ink">
            Floor Layout
          </h2>
          <p className="mt-1 text-[11px] text-slate-500">
            <span className="num">{RESTAURANT_FLOOR_CANVAS_WIDTH}</span>x
            <span className="num">{RESTAURANT_FLOOR_CANVAS_HEIGHT}</span> px ·{" "}
            <span className="num">{layoutTables.length}</span> meja
          </p>
        </div>
        <Button
          type="button"
          className="h-8 rounded-none border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800 hover:text-console-accent"
          disabled={isArranging}
          onClick={handleAutoArrange}
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          {isArranging ? "Arranging..." : "Auto-arrange"}
        </Button>
      </div>

      <div className="overflow-auto p-3.5">
        <div
          className="relative border border-dashed border-console-border bg-console-bg"
          style={{
            width: RESTAURANT_FLOOR_CANVAS_WIDTH,
            height: RESTAURANT_FLOOR_CANVAS_HEIGHT,
          }}
        >
          {layoutTables.map((table) => (
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
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                  {table.capacity} pax
                </span>
                {savingTableId === table.id ? (
                  <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.06em] text-console-accent">
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
