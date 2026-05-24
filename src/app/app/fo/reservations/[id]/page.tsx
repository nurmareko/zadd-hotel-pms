import { ReservationStatus } from "@prisma/client";
import { formatISO } from "date-fns";
import { Download } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { dateOnlyBoundary, todayDateOnly } from "@/lib/date-only";
import { prisma } from "@/lib/prisma";
import { ReservationForm } from "../new/reservation-form";
import type { CreateReservationInput } from "../new/schema";

export const dynamic = "force-dynamic";

type ReservationDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string | string[] }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toDateInputValue(date: Date) {
  return formatISO(date, { representation: "date" });
}

export default async function ReservationDetailPage({
  params,
  searchParams,
}: ReservationDetailPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const reservationId = Number(id);

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    notFound();
  }

  const [reservation, roomTypes, rooms, activeReservations] = await Promise.all([
    prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        guest: true,
        room: { select: { number: true } },
        roomType: { select: { name: true } },
      },
    }),
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
      orderBy: { number: "asc" },
    }),
    prisma.reservation.findMany({
      where: {
        id: { not: reservationId },
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

  if (!reservation) {
    notFound();
  }

  const requestedMode = firstParam(query.mode);
  const formMode = requestedMode === "edit" ? "edit" : "view";
  const { today } = todayDateOnly();
  const canCheckIn =
    reservation.status === ReservationStatus.CONFIRMED &&
    dateOnlyBoundary(reservation.arrivalDate) <= today;
  const canPrintGrc =
    formMode === "view" && reservation.status !== ReservationStatus.CANCELLED;
  const defaultValues: CreateReservationInput = {
    fullName: reservation.guest.fullName,
    idNumber: reservation.guest.idNumber ?? "",
    phone: reservation.guest.phone ?? "",
    email: reservation.guest.email ?? "",
    address: reservation.guest.address ?? "",
    nationality: reservation.guest.nationality ?? "",
    roomTypeId: String(reservation.roomTypeId),
    roomId: reservation.roomId ? String(reservation.roomId) : "",
    arrivalDate: toDateInputValue(reservation.arrivalDate),
    departureDate: toDateInputValue(reservation.departureDate),
    adults: String(reservation.adults),
    children: String(reservation.children),
    reservationType: reservation.reservationType,
    arrangementType: reservation.arrangementType,
    deposit: reservation.deposit.toString(),
    notes: reservation.notes ?? "",
    comment: reservation.comment ?? "",
  };

  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
            <span className="text-console-accent">▸ </span>
            Reservation Form
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            {reservation.reservationNo} · {reservation.status.replace("_", " ")}{" "}
            · {reservation.guest.fullName}
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <Link
            href="/app/fo/reservations"
            className="inline-flex h-8 items-center justify-center border border-console-border bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
          >
            Kembali
          </Link>
          {formMode === "edit" ? (
            <>
              <Link
                href={`/app/fo/reservations/${reservation.id}?mode=view`}
                className="inline-flex h-8 items-center justify-center border border-console-border bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
              >
                Batal
              </Link>
            </>
          ) : (
            <Link
              href={`/app/fo/reservations/${reservation.id}?mode=edit`}
              className="inline-flex h-8 items-center justify-center border border-console-border bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
            >
              Edit Reservasi
            </Link>
          )}
          {canPrintGrc ? (
            <a
              href={`/api/reservations/${reservation.id}/grc`}
              download
              className="inline-flex h-8 items-center justify-center gap-2 border border-console-border bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Cetak GRC
            </a>
          ) : null}
          {canCheckIn ? (
            <Link
              href={`/app/fo/check-in/${reservation.id}`}
              className="inline-flex h-8 items-center justify-center border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
            >
              Check In Guest
            </Link>
          ) : null}
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
          activeReservations={activeReservations.map((activeReservation) => ({
            id: activeReservation.id,
            roomId: activeReservation.roomId ?? 0,
            arrivalDate: toDateInputValue(activeReservation.arrivalDate),
            departureDate: toDateInputValue(activeReservation.departureDate),
          }))}
          mode={formMode}
          reservationId={reservation.id}
          submitLabel="Simpan Perubahan"
        />
      </div>
    </main>
  );
}
