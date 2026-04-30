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
  }));

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Rooms &amp; Room Types
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage hotel inventory for front office and housekeeping.
        </p>
      </div>

      <Tabs defaultValue="room-types" className="mt-6">
        <TabsList>
          <TabsTrigger value="room-types">Room Types</TabsTrigger>
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
        </TabsList>
        <TabsContent value="room-types">
          <RoomTypeTable roomTypes={roomTypes} />
        </TabsContent>
        <TabsContent value="rooms">
          <RoomTable rooms={rooms} roomTypes={roomTypeOptions} />
        </TabsContent>
      </Tabs>
    </>
  );
}
