"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { RestaurantTableLayoutEditor } from "./table-layout-editor";
import { RestaurantTableList, type RestaurantTableRow } from "./table-list";

type RestaurantTablesTabsProps = {
  tables: Array<RestaurantTableRow & { posX: number; posY: number }>;
};

export function RestaurantTablesTabs({ tables }: RestaurantTablesTabsProps) {
  return (
    <>
      <div className="mb-4">
        <Breadcrumb className="mb-2">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/app/admin">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Meja</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Restaurant Tables
        </h1>
        <p className="mt-1 text-sm leading-5 text-slate-500">
          Master meja dan koordinat layout F&amp;B Hotel Restaurant.
        </p>
      </div>

      <Tabs defaultValue="list">
        <TabsList className="mb-4 h-auto rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          <TabsTrigger
            className="rounded-md bg-transparent px-3 py-2 text-sm font-semibold text-slate-500 shadow-none transition-colors hover:bg-slate-50 hover:text-slate-900 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=active]:shadow-none"
            value="list"
          >
            Daftar Meja ({tables.length})
          </TabsTrigger>
          <TabsTrigger
            className="rounded-md bg-transparent px-3 py-2 text-sm font-semibold text-slate-500 shadow-none transition-colors hover:bg-slate-50 hover:text-slate-900 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=active]:shadow-none"
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
