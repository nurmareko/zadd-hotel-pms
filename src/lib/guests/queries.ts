import { prisma } from "@/lib/prisma";
import { buildGuestWhere } from "./filters";
import type { GuestDirectoryRow } from "./types";

export async function findGuests(q: string, take?: number): Promise<GuestDirectoryRow[]> {
  const guests = await prisma.guest.findMany({
    where: buildGuestWhere(q),
    orderBy: [{ fullName: "asc" }, { id: "asc" }],
    take,
    select: {
      id: true,
      fullName: true,
      idType: true,
      idNumber: true,
      phone: true,
      email: true,
      address: true,
      nationality: true,
      _count: { select: { reservations: true } },
      reservations: {
        orderBy: [{ arrivalDate: "desc" }, { id: "desc" }],
        take: 1,
        select: { arrivalDate: true, room: { select: { number: true } } },
      },
    },
  });

  return guests.map(({ _count, reservations, ...guest }) => ({
    ...guest,
    totalStays: _count.reservations,
    lastStayDate: reservations[0]?.arrivalDate.toISOString().slice(0, 10) ?? null,
    lastRoomNumber: reservations[0]?.room?.number ?? null,
  }));
}
