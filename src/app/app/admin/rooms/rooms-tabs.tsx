"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
        <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
          <span className="text-console-accent">▸ </span>
          Kamar &amp; Tipe Kamar
        </h1>
        <p className="mt-1 text-[11px] leading-5 text-slate-500">
          Definisikan tipe kamar dan daftarkan kamar individual.
        </p>
      </div>

      <Tabs defaultValue="room-types">
        <TabsList className="mb-4 h-auto rounded-none border-b border-console-border bg-transparent p-0">
          <TabsTrigger
            className="rounded-none border-b-2 border-transparent bg-transparent px-0 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 shadow-none data-[state=active]:border-console-ink data-[state=active]:bg-transparent data-[state=active]:text-console-ink data-[state=active]:shadow-none"
            value="room-types"
          >
            Tipe Kamar
          </TabsTrigger>
          <TabsTrigger
            className="ml-5 rounded-none border-b-2 border-transparent bg-transparent px-0 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 shadow-none data-[state=active]:border-console-ink data-[state=active]:bg-transparent data-[state=active]:text-console-ink data-[state=active]:shadow-none"
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
