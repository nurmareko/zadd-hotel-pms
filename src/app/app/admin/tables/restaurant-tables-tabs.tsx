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
        <TabsList className="mb-4 h-auto rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger
            className="rounded-none border-b-2 border-transparent bg-transparent px-0 py-2.5 text-sm font-semibold uppercase tracking-[0.06em] text-slate-500 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            value="list"
          >
            Daftar Meja ({tables.length})
          </TabsTrigger>
          <TabsTrigger
            className="ml-5 rounded-none border-b-2 border-transparent bg-transparent px-0 py-2.5 text-sm font-semibold uppercase tracking-[0.06em] text-slate-500 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
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
