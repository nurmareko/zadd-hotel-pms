"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { RestaurantTableLayoutEditor } from "./table-layout-editor";
import { RestaurantTableList, type RestaurantTableRow } from "./table-list";

type RestaurantTablesTabsProps = {
  tables: Array<RestaurantTableRow & { posX: number; posY: number }>;
};

export function RestaurantTablesTabs({ tables }: RestaurantTablesTabsProps) {
  return (
    <>
      <div className="mb-4">
        <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
          <span className="text-console-accent">&gt; </span>
          Restaurant Tables
        </h1>
        <p className="mt-1 text-[11px] leading-5 text-slate-500">
          Master meja dan koordinat layout F&amp;B Hotel Restaurant.
        </p>
      </div>

      <Tabs defaultValue="list">
        <TabsList className="mb-4 h-auto rounded-none border-b border-console-border bg-transparent p-0">
          <TabsTrigger
            className="rounded-none border-b-2 border-transparent bg-transparent px-0 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 shadow-none data-active:border-console-ink data-active:bg-transparent data-active:text-console-ink data-active:shadow-none"
            value="list"
          >
            Daftar Meja ({tables.length})
          </TabsTrigger>
          <TabsTrigger
            className="ml-5 rounded-none border-b-2 border-transparent bg-transparent px-0 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 shadow-none data-active:border-console-ink data-active:bg-transparent data-active:text-console-ink data-active:shadow-none"
            value="layout"
          >
            Layout
          </TabsTrigger>
        </TabsList>
        <TabsContent value="list">
          <RestaurantTableList tables={tables} showHeading={false} />
        </TabsContent>
        <TabsContent value="layout">
          <RestaurantTableLayoutEditor tables={tables} />
        </TabsContent>
      </Tabs>
    </>
  );
}
