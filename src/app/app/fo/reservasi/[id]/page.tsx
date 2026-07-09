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

type ReservationTab = "details" | "folio";

function defaultReservationTab(status: ReservationStatus): ReservationTab {
  return status === ReservationStatus.CHECKED_IN ? "folio" : "details";
}

function resolveReservationTab(
  requestedTab: string | undefined,
  status: ReservationStatus,
): ReservationTab {
  if (requestedTab === "details" || requestedTab === "folio") {
    return requestedTab;
  }

  return defaultReservationTab(status);
}

function tabClassName(isActive: boolean) {
  return [
    "inline-flex h-9 items-center justify-center border px-4 text-sm font-medium rounded-md transition-colors",
    isActive
      ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm",
  ].join(" ");
}

function ReservationTabs({
  reservationId,
  activeTab,
}: {
  reservationId: number;
  activeTab: ReservationTab;
}) {
  return (
    <nav
      aria-label="Reservation detail tabs"
      className="mb-6 flex items-center gap-3 border-b border-slate-200 pb-4"
    >
      <Link
        href={`/app/fo/reservasi/${reservationId}?tab=details`}
        aria-current={activeTab === "details" ? "page" : undefined}
        className={tabClassName(activeTab === "details")}
      >
        Details
      </Link>
      <Link
        href={`/app/fo/reservasi/${reservationId}?tab=folio`}
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Guest Folio
        </h1>
      </div>
      <section className="max-w-6xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 text-sm font-semibold text-slate-700">
          {"Folio"}
        </div>
        <p className="p-5 text-sm text-slate-500">
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
  const activeTab = resolveReservationTab(
    firstParam(query.tab),
    reservation.status,
  );
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
    <main className="min-h-screen bg-slate-50 px-5 py-4 text-slate-900 md:px-6 md:py-5">
      <ReservationTabs reservationId={reservation.id} activeTab={activeTab} />
      {activeTab === "details" ? (
        <>
          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Reservation Form
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {reservation.reservationNo} ·{" "}
                {reservation.status.replace("_", " ")} ·{" "}
                {reservation.guest.fullName}
              </p>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              <Link
                href="/app/fo/reservasi"
                className={consoleButtonClassName("secondary")}
              >
                Kembali
              </Link>
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
              returnHref={`/app/fo/reservasi/${reservation.id}?tab=details&mode=view`}
              submitLabel="Simpan Perubahan"
              viewFooterActions={
                formMode === "view" ? (
                  <>
                    <Link
                      href={`/app/fo/reservasi/${reservation.id}?tab=details&mode=edit`}
                      className={consoleButtonClassName(
                        canCheckIn ? "secondary" : "primary",
                      )}
                    >
                      Edit Reservasi
                    </Link>
                    {canCheckIn ? (
                      <Link
                        href={`/app/fo/check-in/${reservation.id}`}
                        className={consoleButtonClassName("primary")}
                      >
                        Check In Guest
                      </Link>
                    ) : null}
                  </>
                ) : undefined
              }
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
