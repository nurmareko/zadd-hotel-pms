import { ReservationStatus } from "@prisma/client";
import { formatISO } from "date-fns";
import { Download } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { dateOnlyBoundary, todayDateOnly } from "@/lib/date-only";
import { flatReservationNightStayTotal } from "@/lib/flat-reservation-night-total";
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
  return buttonVariants({ variant: isActive ? "default" : "outline" });
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

function reservationStatusLabel(status: ReservationStatus) {
  return status.replace("_", " ");
}

type GroupSibling = {
  id: number;
  reservationNo: string;
  status: ReservationStatus;
  guest: { fullName: string };
  room: { number: string } | null;
  roomType: { name: string };
};

function GroupBookingCard({
  currentReservationId,
  groupBookingId,
  siblings,
}: {
  currentReservationId: number;
  groupBookingId: string;
  siblings: GroupSibling[];
}) {
  return (
    <section className="mb-6 max-w-6xl overflow-hidden rounded-lg border border-sky-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-100 bg-sky-50 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-sky-950">
            Bagian dari booking grup - {siblings.length} kamar
          </h2>
          <p className="mt-1 text-xs font-medium text-sky-700">
            {groupBookingId}
          </p>
        </div>
        <Link
          href={`/app/fo/reservasi/grup/${groupBookingId}`}
          className={buttonVariants({
                      variant: "outline",
                      className: "border-sky-300 text-sky-800 hover:bg-sky-100",
                    })}
        >
          Lihat ringkasan grup
        </Link>
      </div>
      <div className="divide-y divide-slate-100">
        {siblings.map((sibling) => {
          const isCurrent = sibling.id === currentReservationId;

          return (
            <Link
              key={sibling.id}
              href={`/app/fo/reservasi/${sibling.id}`}
              className="grid gap-2 px-5 py-3 text-sm transition-colors hover:bg-slate-50 md:grid-cols-[1fr_1fr_auto]"
            >
              <div>
                <div className="font-semibold text-slate-900">
                  {sibling.reservationNo}
                  {isCurrent ? (
                    <span className="ml-2 text-xs font-medium text-sky-700">
                      saat ini
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 text-slate-500">
                  {sibling.guest.fullName}
                </div>
              </div>
              <div className="text-slate-600">
                {sibling.room?.number ?? "Belum dialokasikan"} ·{" "}
                {sibling.roomType.name}
              </div>
              <div className="font-medium text-slate-700">
                {reservationStatusLabel(sibling.status)}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
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
        reservationNights: {
          select: { date: true, rateAmount: true },
          orderBy: { date: "asc" },
        },
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

  const groupSiblings = reservation.groupBookingId
    ? await prisma.reservation.findMany({
        where: { groupBookingId: reservation.groupBookingId },
        select: {
          id: true,
          reservationNo: true,
          status: true,
          guest: { select: { fullName: true } },
          room: { select: { number: true } },
          roomType: { select: { name: true } },
        },
        orderBy: [{ id: "asc" }],
      })
    : [];

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
  const stayTotal = flatReservationNightStayTotal({
    arrivalDate: reservation.arrivalDate,
    departureDate: reservation.departureDate,
    rateAmount: reservation.rateAmount,
    reservationNights: reservation.reservationNights,
  });
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
                {reservationStatusLabel(reservation.status)} ·{" "}
                {reservation.guest.fullName}
              </p>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              <Link
                              href="/app/fo/reservasi"
                              className={buttonVariants({ variant: "outline" })}
                            >
                Kembali
              </Link>
              {canPrintGrc ? (
                <a
                                  href={`/api/reservations/${reservation.id}/grc`}
                                  download
                                  className={buttonVariants({ variant: "outline" })}
                                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Cetak GRC
                </a>
              ) : null}
              {canCancel ? (
                <div className="border-t border-slate-200 pt-2 sm:ml-1 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
                  <CancelReservationDialog
                    reservationId={reservation.id}
                    reservationNo={reservation.reservationNo}
                  />
                </div>
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
            {reservation.groupBookingId ? (
              <GroupBookingCard
                currentReservationId={reservation.id}
                groupBookingId={reservation.groupBookingId}
                siblings={groupSiblings}
              />
            ) : null}
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
              readOnlyStayTotal={stayTotal.total.toString()}
              readOnlyNightlySchedule={stayTotal.nightlySchedule.map((night) => ({
                date: toDateInputValue(night.date),
                rateAmount: night.rateAmount.toString(),
              }))}
              viewFooterActions={
                formMode === "view" ? (
                  <>
                    <Link
                      href={`/app/fo/reservasi/${reservation.id}?tab=details&mode=edit`}
                      className={buttonVariants({
                                              variant: canCheckIn ? "outline" : "default",
                                            })}
                    >
                      Edit Reservasi
                    </Link>
                    {canCheckIn ? (
                      <Link
                                              href={`/app/fo/check-in/${reservation.id}`}
                                              className={buttonVariants({ variant: "default" })}
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
