import { prisma } from "@/lib/prisma";
import { RoomsTabs } from "./rooms-tabs";

export default async function RoomsAndRoomTypesPage() {
  const [roomTypes, rooms] = await Promise.all([
    prisma.roomType.findMany({
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        capacity: true,
        baseRate: true,
      },
    }),
    prisma.room.findMany({
      orderBy: { number: "asc" },
      select: {
        id: true,
        number: true,
        floor: true,
        roomTypeId: true,
        status: true,
        roomType: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  return (
    <main className="p-4 sm:p-6">
      <RoomsTabs
        roomTypes={roomTypes.map((roomType) => ({
          ...roomType,
          baseRate: roomType.baseRate.toString(),
        }))}
        rooms={rooms.map((room) => ({
          id: room.id,
          number: room.number,
          floor: room.floor,
          roomTypeId: room.roomTypeId,
          roomTypeName: room.roomType.name,
          status: room.status,
        }))}
      />
    </main>
  );
}
