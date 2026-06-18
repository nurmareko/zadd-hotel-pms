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
import { RoomTable, type RoomRow } from "./room-table";
import { RoomTypeTable, type RoomTypeRow } from "./room-type-table";

type RoomsTabsProps = {
  roomTypes: RoomTypeRow[];
  rooms: RoomRow[];
};

export function RoomsTabs({ roomTypes, rooms }: RoomsTabsProps) {
  const roomTypeOptions = roomTypes.map((roomType) => ({
    id: roomType.id,
    code: roomType.code,
    name: roomType.name,
    baseRate: roomType.baseRate,
  }));

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
              <BreadcrumbPage>Kamar</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Kamar &amp; Tipe Kamar
        </h1>
        <p className="mt-1 text-sm leading-5 text-slate-500">
          Definisikan tipe kamar dan daftarkan kamar individual.
        </p>
      </div>

      <Tabs defaultValue="room-types">
        <TabsList className="mb-4 h-auto rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger
            className="rounded-none border-b-2 border-transparent bg-transparent px-0 py-2.5 text-sm font-semibold uppercase tracking-[0.06em] text-slate-500 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            value="room-types"
          >
            Tipe Kamar
          </TabsTrigger>
          <TabsTrigger
            className="ml-5 rounded-none border-b-2 border-transparent bg-transparent px-0 py-2.5 text-sm font-semibold uppercase tracking-[0.06em] text-slate-500 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            value="rooms"
          >
            Daftar Kamar ({rooms.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="room-types">
          <RoomTypeTable roomTypes={roomTypes} rooms={rooms} />
        </TabsContent>
        <TabsContent value="rooms">
          <RoomTable rooms={rooms} roomTypes={roomTypeOptions} />
        </TabsContent>
      </Tabs>
    </>
  );
}
