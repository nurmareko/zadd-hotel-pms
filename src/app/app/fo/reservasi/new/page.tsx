import { addDays, formatISO } from "date-fns";
import { cookies } from "next/headers";

import {
  FO_RESERVASI_VIEW_COOKIE,
  FO_RESERVASI_VIEW_PATHS,
  parseFoReservasiView,
} from "@/lib/nav-preferences";
import { ARRANGEMENT_INCLUSION_ARTICLE_CODES } from "@/lib/arrangement-inclusions";
import { prisma } from "@/lib/prisma";

import { ReservationForm } from "./reservation-form";
import type { CreateReservationInput } from "./schema";

export const dynamic = "force-dynamic";

const arrangementInclusionArticleCodes = [
  ...new Set(Object.values(ARRANGEMENT_INCLUSION_ARTICLE_CODES).flat()),
];

type NewReservationPageProps = {
  searchParams: Promise<{
    roomTypeId?: string | string[];
    roomId?: string | string[];
    arrival?: string | string[];
    departure?: string | string[];
    from?: string | string[];
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

function parsePositiveIntParam(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function toDateInputValue(date: Date) {
  return formatISO(date, { representation: "date" });
}

export default async function NewReservationPage({
  searchParams,
}: NewReservationPageProps) {
  const params = await searchParams;
  const requestedRoomId = parsePositiveIntParam(firstParam(params.roomId));
  const requestedRoomTypeId = parsePositiveIntParam(
    firstParam(params.roomTypeId),
  );
  const originView =
    parseFoReservasiView(params.from) ??
    parseFoReservasiView(
      (await cookies()).get(FO_RESERVASI_VIEW_COOKIE)?.value,
    ) ??
    "list";
  const arrivalDate = parseDateParam(firstParam(params.arrival)) ?? new Date();
  const departureDate =
    parseDateParam(firstParam(params.departure)) ?? addDays(arrivalDate, 1);
  const [roomTypes, rooms, activeReservations, inclusionArticles] = await Promise.all([
    prisma.roomType.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        capacity: true,
        baseRate: true,
      },
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
      orderBy: [{ floor: "asc" }, { number: "asc" }],
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
    prisma.article.findMany({
      where: { code: { in: arrangementInclusionArticleCodes } },
      select: { code: true, name: true },
      orderBy: { code: "asc" },
    }),
  ]);
  const requestedRoom = requestedRoomId
    ? rooms.find((room) => room.id === requestedRoomId)
    : undefined;
  const requestedRoomType = requestedRoomTypeId
    ? roomTypes.find((roomType) => roomType.id === requestedRoomTypeId)
    : undefined;
  const defaultRoomTypeId = requestedRoom
    ? requestedRoom.roomTypeId
    : requestedRoomType?.id;
  const defaultValues: CreateReservationInput = {
    fullName: "",
    idNumber: "",
    phone: "",
    email: "",
    address: "",
    nationality: "Indonesia",
    roomTypeId: defaultRoomTypeId ? String(defaultRoomTypeId) : "",
    roomId: requestedRoom ? String(requestedRoom.id) : "",
    arrivalDate: toDateInputValue(arrivalDate),
    departureDate: toDateInputValue(departureDate),
    adults: "1",
    children: "0",
    reservationType: "INDIVIDUAL",
    arrangementType: "RO",
    deposit: "0",
    notes: "",
  };
  const allocatedActiveReservations = activeReservations.flatMap(
    (reservation) =>
      reservation.roomId === null
        ? []
        : [
            {
              id: reservation.id,
              roomId: reservation.roomId,
              arrivalDate: toDateInputValue(reservation.arrivalDate),
              departureDate: toDateInputValue(reservation.departureDate),
            },
          ],
  );

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-4 text-slate-900 md:px-6 md:py-5">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Reservasi Baru
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Isi data tamu dan periode menginap untuk membuat reservasi.
        </p>
      </div>

      <div className="max-w-6xl">
        <ReservationForm
          defaultValues={defaultValues}
          roomTypes={roomTypes.map((roomType) => ({
            ...roomType,
            baseRate: roomType.baseRate.toString(),
            nightlyRateQuote: roomType.baseRate.toString(),
          }))}
          rooms={rooms}
          activeReservations={allocatedActiveReservations}
          inclusionArticles={inclusionArticles}
          createOrigin={originView}
          returnHref={FO_RESERVASI_VIEW_PATHS[originView]}
          submitLabel="Simpan Reservasi"
        />
      </div>
    </main>
  );
}
