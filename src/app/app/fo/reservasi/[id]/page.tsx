import {
  ArrangementType,
  DepositStatus,
  PaymentPurpose,
  Prisma,
  ReservationStatus,
  ReservationStayFeeKind,
  RoomStatus,
} from "@prisma/client";
import { differenceInCalendarDays, formatISO } from "date-fns";
import { Download } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DepositStatusBadge } from "@/components/deposit-status-badge";
import { GuestFolioView } from "@/components/folio/folio-view";
import { buttonVariants } from "@/components/ui/button";
import { MEAL_ARTICLE_CODES, MEAL_PLAN_DEFINITIONS } from "@/lib/arrangement-inclusions";
import { dateOnlyBoundary, todayDateOnly } from "@/lib/date-only";
import { flatReservationNightStayTotal } from "@/lib/flat-reservation-night-total";
import { formatDateID } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { STAY_FEE_DEFINITIONS } from "@/lib/reservation-stay-fee-definitions";
import { ReservationForm } from "../new/reservation-form";
import type { CreateReservationInput } from "../new/schema";
import { CancelReservationDialog } from "./cancel-reservation-dialog";
import {
  CheckInDetailAffordance,
  CheckInDetailPanel,
} from "./check-in-detail-panel";
import { InclusionPanel } from "./inclusion-panel";
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

type ReservationTab =
  | "details"
  | "inclusions"
  | "pembayaran"
  | "tagihan";

function defaultReservationTab(status: ReservationStatus): ReservationTab {
  return status === ReservationStatus.CHECKED_IN ? "tagihan" : "details";
}

function resolveReservationTab(
  requestedTab: string | undefined,
  status: ReservationStatus,
): ReservationTab {
  if (requestedTab === "folio") {
    return "tagihan";
  }

  if (
    requestedTab === "details" ||
    requestedTab === "inclusions" ||
    requestedTab === "pembayaran" ||
    requestedTab === "tagihan"
  ) {
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
      aria-label="Tab detail reservasi"
      className="flex w-full items-center gap-3 overflow-x-auto pb-1 sm:w-auto sm:pb-0"
    >
      <Link
        href={`/app/fo/reservasi/${reservationId}?tab=details`}
        aria-current={activeTab === "details" ? "page" : undefined}
        className={`${tabClassName(activeTab === "details")} shrink-0`}
      >
        Detail
      </Link>
      <Link
        href={`/app/fo/reservasi/${reservationId}?tab=inclusions`}
        aria-current={activeTab === "inclusions" ? "page" : undefined}
        className={`${tabClassName(activeTab === "inclusions")} shrink-0`}
      >
        Inklusi
      </Link>
      <Link
        href={`/app/fo/reservasi/${reservationId}?tab=pembayaran`}
        aria-current={activeTab === "pembayaran" ? "page" : undefined}
        className={`${tabClassName(activeTab === "pembayaran")} shrink-0`}
      >
        Pembayaran
      </Link>
      <Link
        href={`/app/fo/reservasi/${reservationId}?tab=tagihan`}
        aria-current={activeTab === "tagihan" ? "page" : undefined}
        className={`${tabClassName(activeTab === "tagihan")} shrink-0`}
      >
        Tagihan
      </Link>
    </nav>
  );
}

function FolioPendingState({ title }: { title: "Pembayaran" | "Tagihan" }) {
  return (
    <section className="max-w-6xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-700">
        {title}
      </div>
      <p className="p-5 text-sm text-slate-500">
        Folio dibuat saat pengumpulan deposit. Setelah folio tersedia,
        transaksi {title.toLowerCase()} akan ditampilkan di sini.
      </p>
    </section>
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
    <section className="mb-6 overflow-hidden rounded-lg border border-sky-200 bg-white shadow-sm">
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
        room: {
          select: { id: true, number: true, status: true, roomTypeId: true },
        },
        roomType: { select: { name: true } },
        folio: {
          select: {
            id: true,
            payments: {
              where: { purpose: PaymentPurpose.DEPOSIT },
              select: { amount: true, method: true, reference: true },
              orderBy: { receivedAt: "asc" },
              take: 1,
            },
          },
        },
        stayFees: {
          orderBy: { kind: "asc" },
        },
        reservationNights: {
          select: {
            id: true,
            date: true,
            rateAmount: true,
            mealPlan: true,
            mealPax: true,
            mealUnitPrice: true,
            mealAmount: true,
            folioLineItems: {
              where: { article: { code: { in: [...MEAL_ARTICLE_CODES] } } },
              take: 1,
              select: { id: true },
            },
          },
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
  const isTerminalReservation =
    reservation.status === ReservationStatus.CHECKED_OUT ||
    reservation.status === ReservationStatus.CANCELLED ||
    reservation.status === ReservationStatus.NO_SHOW;
  const formMode =
    requestedMode === "edit" && !isTerminalReservation ? "edit" : "view";
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
    idType: reservation.guest.idType ?? "",
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
    notes: reservation.notes ?? "",
    stayFeeKinds: [],
  };
  const stayTotal = flatReservationNightStayTotal({
    arrivalDate: reservation.arrivalDate,
    departureDate: reservation.departureDate,
    rateAmount: reservation.rateAmount,
    reservationNights: reservation.reservationNights,
  });
  const inclusionTotal = reservation.reservationNights.reduce(
    (total, night) => total.plus(night.mealAmount ?? 0),
    new Prisma.Decimal(0),
  );
  const assignedRoomHasOverlap = reservation.room
    ? activeReservations.some(
        (activeReservation) =>
          activeReservation.roomId === reservation.room?.id &&
          activeReservation.arrivalDate < reservation.departureDate &&
          activeReservation.departureDate > reservation.arrivalDate,
      )
    : false;
  const roomReady = Boolean(
    reservation.room &&
      reservation.room.roomTypeId === reservation.roomTypeId &&
      reservation.room.status !== RoomStatus.OOO &&
      !assignedRoomHasOverlap,
  );
  const depositPayment = reservation.folio?.payments[0] ?? null;
  const initialCheckInReview = {
    snapshotVersion: reservation.updatedAt.toISOString(),
    reservationId: reservation.id,
    reservationNo: reservation.reservationNo,
    reservationType: reservation.reservationType,
    arrangementType: reservation.arrangementType,
    status: reservation.status,
    arrivalDue: canCheckIn,
    guest: {
      fullName: reservation.guest.fullName,
      idType: reservation.guest.idType,
      idNumber: reservation.guest.idNumber,
      phone: reservation.guest.phone,
      email: reservation.guest.email,
      nationality: reservation.guest.nationality,
    },
    stay: {
      arrivalLabel: formatDateID(reservation.arrivalDate),
      departureLabel: formatDateID(reservation.departureDate),
      nights: differenceInCalendarDays(
        reservation.departureDate,
        reservation.arrivalDate,
      ),
      adults: reservation.adults,
      children: reservation.children,
      total: stayTotal.total.toString(),
      nightlySchedule: stayTotal.nightlySchedule.map((night) => ({
        dateLabel: formatDateID(night.date),
        rateAmount: night.rateAmount.toString(),
      })),
    },
    room: reservation.room
      ? {
          id: reservation.room.id,
          number: reservation.room.number,
          status: reservation.room.status,
          typeName: reservation.roomType.name,
        }
      : null,
    roomReady,
    deposit: {
      status: reservation.depositStatus,
      requiredAmount:
        reservation.reservationNights[0]?.rateAmount.toString() ?? null,
      payment: depositPayment
        ? {
            amount: depositPayment.amount.toString(),
            method: depositPayment.method,
            reference: depositPayment.reference,
          }
        : null,
    },
  };
  const mealPlanLabels: Record<ArrangementType, string> = {
    RO: "RO — Tanpa makan",
    BB: "BB — Sarapan",
    HB: "HB — Sarapan + satu kali makan utama",
    FB: "FB — Sarapan, makan siang, dan makan malam",
  };
  const currentMealDefinition = MEAL_PLAN_DEFINITIONS[reservation.arrangementType];
  const inclusionNights = reservation.reservationNights.map((night) => {
    const isPosted = night.folioLineItems.length > 0;
    const isElapsed = dateOnlyBoundary(night.date) < today;

    return {
      id: night.id,
      dateLabel: formatDateID(night.date),
      plan: night.mealPlan ?? ArrangementType.RO,
      pax: night.mealPax ?? reservation.adults + reservation.children,
      unitPrice: night.mealUnitPrice?.toString() ?? "0",
      amount: night.mealAmount?.toString() ?? "0",
      lockReason: isTerminalReservation
        ? ("terminal" as const)
        : isPosted
          ? ("posted" as const)
          : isElapsed
            ? ("elapsed" as const)
            : null,
    };
  });
  const editableInclusionNights = inclusionNights.filter(
    (night) => night.lockReason === null,
  );
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
      <div className="mb-6 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <ReservationTabs reservationId={reservation.id} activeTab={activeTab} />
        {activeTab === "details" ? (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
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
        ) : null}
      </div>

      {activeTab === "details" ? (
        <>
          {reservation.groupBookingId ? (
            <GroupBookingCard
              currentReservationId={reservation.id}
              groupBookingId={reservation.groupBookingId}
              siblings={groupSiblings}
            />
          ) : null}
          {formMode === "view" &&
          !isTerminalReservation &&
          !reservation.groupBookingId ? (
            <CheckInDetailPanel initialReview={initialCheckInReview} />
          ) : null}
          <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Status deposit
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {reservation.depositStatus === DepositStatus.PENDING
                  ? "Kumpulkan deposit di langkah check-in sebelum tamu dapat di-check-in."
                  : "Status COLLECTED harus disertai pembayaran DEPOSIT yang sesuai pada folio. Check-in hanya dapat dilanjutkan setelah semua persyaratan terverifikasi."}
              </p>
            </div>
            <DepositStatusBadge status={reservation.depositStatus} />
          </section>
          <div className="min-w-0">
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
              readOnlyInclusionTotal={inclusionTotal.toString()}
              readOnlyDeposit={reservation.deposit.toString()}
              readOnlyNightlySchedule={stayTotal.nightlySchedule.map((night) => ({
                date: toDateInputValue(night.date),
                rateAmount: night.rateAmount.toString(),
              }))}
              viewFooterActions={
                formMode === "view" ? (
                  <>
                    {!isTerminalReservation ? (
                      <Link
                        href={`/app/fo/reservasi/${reservation.id}?tab=details&mode=edit`}
                        className={buttonVariants({
                          variant: canCheckIn ? "outline" : "default",
                        })}
                      >
                        Edit Reservasi
                      </Link>
                    ) : null}
                    {canCheckIn ? (
                      reservation.depositStatus === DepositStatus.COLLECTED ? (
                        <CheckInDetailAffordance
                          intent="review"
                          label="Check In Guest"
                        />
                      ) : (
                        <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center">
                          <span
                            aria-disabled="true"
                            className={buttonVariants({
                              variant: "default",
                              className:
                                "cursor-not-allowed opacity-50 pointer-events-none",
                            })}
                          >
                            Check In Guest
                          </span>
                          <CheckInDetailAffordance
                            intent="deposit"
                            label="Kumpulkan Deposit"
                            variant="outline"
                          />
                          <span className="text-xs font-medium text-amber-700 sm:max-w-40">
                            Kumpulkan deposit terlebih dahulu.
                          </span>
                        </div>
                      )
                    ) : null}
                  </>
                ) : undefined
              }
            />
          </div>
        </>
      ) : activeTab === "inclusions" ? (
        <InclusionPanel
          reservationId={reservation.id}
          currentPlan={reservation.arrangementType}
          currentPlanLabel={mealPlanLabels[reservation.arrangementType]}
          currentUnitPrice={currentMealDefinition?.unitPrice.toString() ?? "0"}
          pax={reservation.adults + reservation.children}
          nights={inclusionNights}
          options={Object.values(ArrangementType).map((plan) => ({
            value: plan,
            label: mealPlanLabels[plan],
            unitPrice: MEAL_PLAN_DEFINITIONS[plan]?.unitPrice.toString() ?? "0",
          }))}
          terminal={isTerminalReservation}
          effectiveDateLabel={editableInclusionNights[0]?.dateLabel ?? null}
          editableNightCount={editableInclusionNights.length}
          inHouse={reservation.status === ReservationStatus.CHECKED_IN}
          stayFees={(
            ["EARLY_CHECK_IN", "LATE_CHECK_OUT"] as ReservationStayFeeKind[]
          ).map((kind) => {
            const fee = reservation.stayFees.find((item) => item.kind === kind);

            return {
              kind,
              label: STAY_FEE_DEFINITIONS[kind].label,
              unitPrice:
                fee?.unitPrice.toString() ??
                STAY_FEE_DEFINITIONS[kind].unitPrice.toString(),
              status: fee?.status ?? null,
            };
          })}
        />
      ) : reservation.folio ? (
        <GuestFolioView
          folioId={reservation.folio.id}
          mode={activeTab === "pembayaran" ? "payments" : "charges"}
        />
      ) : (
        <FolioPendingState
          title={activeTab === "pembayaran" ? "Pembayaran" : "Tagihan"}
        />
      )}
    </main>
  );
}
