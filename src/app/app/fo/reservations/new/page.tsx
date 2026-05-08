import { addDays, formatISO } from "date-fns";
import Link from "next/link";

import { prisma } from "@/lib/prisma";

import { ReservationForm } from "./reservation-form";
import type { CreateReservationInput } from "./schema";

export const dynamic = "force-dynamic";

type NewReservationPageProps = {
  searchParams: Promise<{
    roomId?: string | string[];
    arrival?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseDateParam(value: string | undefined) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return undefined;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, monthIndex, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== monthIndex ||
    parsed.getUTCDate() !== day
  ) {
    return undefined;
  }

  return parsed;
}

function toDateInputValue(date: Date) {
  return formatISO(date, { representation: "date" });
}

export default async function NewReservationPage({
  searchParams,
}: NewReservationPageProps) {
  const params = await searchParams;
  const requestedRoomId = Number(firstParam(params.roomId));
  const arrivalDate = parseDateParam(firstParam(params.arrival)) ?? new Date();
  const departureDate = addDays(arrivalDate, 1);
  const [roomTypes, rooms, activeReservations] = await Promise.all([
    prisma.roomType.findMany({
      select: { id: true, code: true, name: true, baseRate: true },
      orderBy: { code: "asc" },
    }),
    prisma.room.findMany({
      select: {
        id: true,
        number: true,
        floor: true,
        status: true,
        roomTypeId: true,
      },
      orderBy: { number: "asc" },
    }),
    prisma.reservation.findMany({
      where: {
        roomId: { not: null },
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
      },
      select: {
        id: true,
        roomId: true,
        arrivalDate: true,
        departureDate: true,
      },
    }),
  ]);
  const requestedRoom = Number.isInteger(requestedRoomId)
    ? rooms.find((room) => room.id === requestedRoomId)
    : undefined;
  const defaultValues: CreateReservationInput = {
    fullName: "",
    idNumber: "",
    phone: "",
    email: "",
    address: "",
    nationality: "Indonesia",
    roomTypeId: requestedRoom ? String(requestedRoom.roomTypeId) : "",
    roomId: requestedRoom ? String(requestedRoom.id) : "",
    arrivalDate: toDateInputValue(arrivalDate),
    departureDate: toDateInputValue(departureDate),
    adults: "1",
    children: "0",
    deposit: "0",
    notes: "",
  };

  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
            <span className="text-console-accent">▸ </span>
            Reservasi Baru
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            Isi data tamu dan periode menginap untuk membuat reservasi.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <Link
            href="/app/fo/reservations"
            className="inline-flex h-8 items-center justify-center border border-console-border bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
          >
            Batal
          </Link>
          <button
            type="submit"
            form="reservation-form"
            className="h-8 rounded-none border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
          >
            Simpan Reservasi
          </button>
        </div>
      </div>

      <div className="max-w-6xl">
        <ReservationForm
          defaultValues={defaultValues}
          roomTypes={roomTypes.map((roomType) => ({
            ...roomType,
            baseRate: roomType.baseRate.toString(),
          }))}
          rooms={rooms}
          activeReservations={activeReservations.map((reservation) => ({
            id: reservation.id,
            roomId: reservation.roomId ?? 0,
            arrivalDate: toDateInputValue(reservation.arrivalDate),
            departureDate: toDateInputValue(reservation.departureDate),
          }))}
        />
      </div>
    </main>
  );
}
