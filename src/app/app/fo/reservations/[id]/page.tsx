import { ReservationStatus } from "@prisma/client";
import { formatISO } from "date-fns";
import { Download } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { consoleButtonClassName } from "@/components/console-button";
import { dateOnlyBoundary, todayDateOnly } from "@/lib/date-only";
import { prisma } from "@/lib/prisma";
import { GuestFolioView } from "../../folios/[id]/folio-view";
import { ReservationForm } from "../new/reservation-form";
import type { CreateReservationInput } from "../new/schema";
import { CancelReservationDialog } from "./cancel-reservation-dialog";
import { RequestCleaningButton } from "./request-cleaning-button";

export const dynamic = "force-dynamic";

type ReservationDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    mode?: string | string[];
    tab?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toDateInputValue(date: Date) {
  return formatISO(date, { representation: "date" });
}

function tabClassName(isActive: boolean) {
  return [
    "inline-flex h-8 items-center justify-center border px-4 text-[11px] font-semibold uppercase tracking-[0.06em]",
    isActive
      ? "border-console-ink bg-console-ink text-console-accent"
      : "border-console-border bg-console-surface text-console-ink hover:border-console-ink hover:bg-console-bg",
  ].join(" ");
}

function ReservationTabs({
  reservationId,
  activeTab,
}: {
  reservationId: number;
  activeTab: "details" | "folio";
}) {
  return (
    <nav
      aria-label="Reservation detail tabs"
      className="mb-4 flex items-center gap-2 border-b border-console-border pb-2"
    >
      <Link
        href={`/app/fo/reservations/${reservationId}?tab=details`}
        aria-current={activeTab === "details" ? "page" : undefined}
        className={tabClassName(activeTab === "details")}
      >
        Details
      </Link>
      <Link
        href={`/app/fo/reservations/${reservationId}?tab=folio`}
        aria-current={activeTab === "folio" ? "page" : undefined}
        className={tabClassName(activeTab === "folio")}
      >
        Folio
      </Link>
    </nav>
  );
}

function FolioPendingState() {
  return (
    <>
      <div className="mb-4">
        <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
          <span className="text-console-accent">▸ </span>
          Guest Folio
        </h1>
      </div>
      <section className="max-w-6xl border border-console-border bg-console-surface">
        <div className="bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
          {"// Folio"}
        </div>
        <p className="p-3.5 text-[12px] text-slate-500">
          Folio dibuat saat check-in.
        </p>
      </section>
    </>
  );
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
        room: { select: { number: true, status: true } },
        roomType: { select: { name: true } },
        folio: { select: { id: true } },
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
      orderBy: [{ floor: "asc" }, { number: "asc" }],
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
  const activeTab = firstParam(query.tab) === "folio" ? "folio" : "details";
  const { today } = todayDateOnly();
  const canCheckIn =
    reservation.status === ReservationStatus.CONFIRMED &&
    dateOnlyBoundary(reservation.arrivalDate) <= today;
  const canPrintGrc =
    formMode === "view" && reservation.status !== ReservationStatus.CANCELLED;
  const canCancel =
    formMode === "view" &&
    reservation.status === ReservationStatus.CONFIRMED;
  const canRequestCleaning =
    formMode === "view" &&
    reservation.status === ReservationStatus.CHECKED_IN;
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
  const allocatedActiveReservations = activeReservations.flatMap(
    (activeReservation) =>
      activeReservation.roomId === null
        ? []
        : [
            {
              id: activeReservation.id,
              roomId: activeReservation.roomId,
              arrivalDate: toDateInputValue(activeReservation.arrivalDate),
              departureDate: toDateInputValue(activeReservation.departureDate),
            },
          ],
  );

  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <ReservationTabs reservationId={reservation.id} activeTab={activeTab} />
      {activeTab === "details" ? (
        <>
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
                <span className="text-console-accent">▸ </span>
                Reservation Form
              </h1>
              <p className="mt-1 text-[11px] text-slate-500">
                {reservation.reservationNo} ·{" "}
                {reservation.status.replace("_", " ")} ·{" "}
                {reservation.guest.fullName}
              </p>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              <Link
                href="/app/fo/reservations"
                className={consoleButtonClassName("secondary")}
              >
                Kembali
              </Link>
              {formMode === "edit" ? (
                <>
                  <Link
                    href={`/app/fo/reservations/${reservation.id}?tab=details&mode=view`}
                    className={consoleButtonClassName("secondary")}
                  >
                    Batal
                  </Link>
                </>
              ) : (
                <Link
                  href={`/app/fo/reservations/${reservation.id}?tab=details&mode=edit`}
                  className={consoleButtonClassName("secondary")}
                >
                  Edit Reservasi
                </Link>
              )}
              {canPrintGrc ? (
                <a
                  href={`/api/reservations/${reservation.id}/grc`}
                  download
                  className={consoleButtonClassName("secondary")}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Cetak GRC
                </a>
              ) : null}
              {canCancel ? (
                <CancelReservationDialog
                  reservationId={reservation.id}
                  reservationNo={reservation.reservationNo}
                />
              ) : null}
              {canRequestCleaning ? (
                <RequestCleaningButton
                  reservationId={reservation.id}
                  roomStatus={reservation.room?.status ?? null}
                />
              ) : null}
              {canCheckIn ? (
                <Link
                  href={`/app/fo/check-in/${reservation.id}`}
                  className={consoleButtonClassName("primary")}
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
              activeReservations={allocatedActiveReservations}
              mode={formMode}
              reservationId={reservation.id}
              submitLabel="Simpan Perubahan"
            />
          </div>
        </>
      ) : reservation.folio ? (
        <GuestFolioView folioId={reservation.folio.id} />
      ) : (
        <FolioPendingState />
      )}
    </main>
  );
}
