import { FolioStatus, ReservationStatus } from "@prisma/client";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DepositStatusBadge } from "@/components/deposit-status-badge";
import { StatusBadge } from "@/components/status-badge";
import { computeFolioTotals } from "@/lib/folio-totals";
import { roundedFolioBalance } from "@/lib/folio-balance-display";
import { formatDateID, formatIDR, formatISODate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { hasSharedReservationStatusColor } from "@/lib/reservation-status-colors";
import { GroupSettlementActions } from "./group-settlement-actions";
import { todayDateOnly } from "@/lib/date-only";

export const dynamic = "force-dynamic";

type GroupBookingPageProps = {
  params: Promise<{ groupBookingId: string }>;
};

const statusLabels: Record<ReservationStatus, string> = {
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked In",
  CHECKED_OUT: "Checked Out",
  CANCELLED: "Cancelled",
  NO_SHOW: "No Show",
};

const noShowClassNames = {
  badge: "border-status-od-pip bg-status-od-bg text-status-od-fg",
  pip: "bg-status-od-pip",
};

function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  if (hasSharedReservationStatusColor(status)) {
    return <StatusBadge label={statusLabels[status]} reservationStatus={status} />;
  }

  return (
    <StatusBadge
      label={statusLabels[status]}
      className={noShowClassNames.badge}
      pipClassName={noShowClassNames.pip}
    />
  );
}

function statusCount(
  reservations: { status: ReservationStatus }[],
  status: ReservationStatus,
) {
  return reservations.filter((reservation) => reservation.status === status)
    .length;
}

export default async function GroupBookingPage({
  params,
}: GroupBookingPageProps) {
  const { groupBookingId } = await params;

  if (!groupBookingId.trim()) {
    notFound();
  }

  const [reservations, settings] = await Promise.all([
    prisma.reservation.findMany({
      where: { groupBookingId },
      include: {
        guest: {
          select: {
            fullName: true,
            idNumber: true,
            phone: true,
            email: true,
            nationality: true,
          },
        },
        room: { select: { number: true } },
        roomType: { select: { name: true } },
        folio: {
          include: {
            lineItems: { include: { article: true } },
            payments: true,
          },
        },
      },
      orderBy: [{ room: { number: "asc" } }, { id: "asc" }],
    }),
    prisma.hotelSettings.findUniqueOrThrow({ where: { id: 1 } }),
  ]);

  if (reservations.length === 0) {
    notFound();
  }

  const primaryReservation = reservations[0];
  const balances = reservations.flatMap((reservation) => {
    // A voided folio is not a live per-room balance and is excluded from the
    // display-only group roll-up, just like a room with no folio.
    if (!reservation.folio || reservation.folio.status === FolioStatus.VOIDED) {
      return [];
    }

    return [
      {
        reservationId: reservation.id,
        balance: computeFolioTotals(
          reservation.folio.lineItems,
          reservation.folio.payments,
          settings,
        ).balance,
      },
    ];
  });
  const balanceByReservationId = new Map(
    balances.map((balance) => [balance.reservationId, balance.balance]),
  );
  const totalGroupBalance = roundedFolioBalance(
    balances.reduce((sum, balance) => sum + balance.balance, 0),
  );
  const roomsWithoutFolio = reservations.filter(
    (reservation) => !reservation.folio,
  ).length;
  const roomsWithVoidedFolio = reservations.filter(
    (reservation) => reservation.folio?.status === FolioStatus.VOIDED,
  ).length;
  const confirmedCount = statusCount(reservations, ReservationStatus.CONFIRMED);
  const checkedInCount = statusCount(
    reservations,
    ReservationStatus.CHECKED_IN,
  );
  const checkedOutCount = statusCount(
    reservations,
    ReservationStatus.CHECKED_OUT,
  );
  const inactiveCount =
    statusCount(reservations, ReservationStatus.CANCELLED) +
    statusCount(reservations, ReservationStatus.NO_SHOW);
  const { today } = todayDateOnly();
  const checkInRooms = reservations.map((reservation) => ({
    reservationId: reservation.id,
    reservationNo: reservation.reservationNo,
    roomId: reservation.roomId,
    roomNumber: reservation.room?.number ?? null,
    status: reservation.status,
    depositStatus: reservation.depositStatus,
    arrivalDate: formatISODate(reservation.arrivalDate),
    guest: reservation.guest,
  }));

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-4 text-slate-900 md:px-6 md:py-5">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <Link
          href="/app/fo/reservasi/list"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Kembali ke daftar reservasi
        </Link>
        <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900">
          Setiap kamar memiliki reservasi dan folio sendiri. Aksi grup tetap
          menjalankan proses per kamar tersebut.
        </p>
      </div>

      <GroupSettlementActions
        groupBookingId={groupBookingId}
        checkInRooms={checkInRooms}
        todayIso={formatISODate(today)}
      />

      <section className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Informasi booking
          </h2>
        </div>
        <dl className="grid gap-5 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs font-medium text-slate-500">
              Kontak utama
            </dt>
            <dd className="mt-1 font-semibold text-slate-900">
              {primaryReservation.guest.fullName}
            </dd>
            {primaryReservation.guest.phone ? (
              <dd className="mt-0.5 text-sm text-slate-600">
                {primaryReservation.guest.phone}
              </dd>
            ) : null}
            {primaryReservation.guest.email ? (
              <dd className="mt-0.5 text-sm text-slate-600">
                {primaryReservation.guest.email}
              </dd>
            ) : null}
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Kedatangan</dt>
            <dd className="mt-1 font-semibold text-slate-900">
              {formatDateID(primaryReservation.arrivalDate)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Keberangkatan</dt>
            <dd className="mt-1 font-semibold text-slate-900">
              {formatDateID(primaryReservation.departureDate)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Kamar</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Buka reservasi masing-masing kamar untuk tindakan individual.
            </p>
          </div>
          <span className="text-sm font-medium text-slate-500">
            {reservations.length} reservasi
          </span>
        </div>
        <div className="max-w-full overflow-auto">
          <table className="w-full min-w-[1080px] border-collapse text-sm">
            <caption className="sr-only">
              Daftar kamar dalam booking grup {groupBookingId}
            </caption>
            <thead>
              <tr>
                <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">
                  Reservasi / tamu
                </th>
                <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">
                  Kamar / tipe
                </th>
                <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">
                  Status
                </th>
                <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">
                  Tanggal
                </th>
                <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">
                  Deposit
                </th>
                <th className="bg-slate-50 px-4 py-3 text-right text-xs font-semibold text-slate-600">
                  Saldo folio
                </th>
                <th className="bg-slate-50 px-4 py-3 text-right text-xs font-semibold text-slate-600">
                  Detail
                </th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((reservation) => {
                const balance = balanceByReservationId.get(reservation.id);

                return (
                  <tr
                    key={reservation.id}
                    className="border-t border-slate-100 transition-colors hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/app/fo/reservasi/${reservation.id}`}
                        className="font-semibold text-slate-900 hover:text-slate-700 hover:underline"
                      >
                        {reservation.reservationNo}
                      </Link>
                      <div className="mt-0.5 text-slate-600">
                        {reservation.guest.fullName}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="font-semibold text-slate-900">
                        {reservation.room?.number ?? "Belum dialokasikan"}
                      </div>
                      <div className="mt-0.5 text-slate-500">
                        {reservation.roomType.name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <ReservationStatusBadge status={reservation.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{formatDateID(reservation.arrivalDate)}</div>
                      <div className="mt-0.5 text-slate-500">
                        s.d. {formatDateID(reservation.departureDate)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <DepositStatusBadge status={reservation.depositStatus} />
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900">
                      {balance === undefined ? (
                        <span className="text-xs font-medium text-slate-400">
                          {reservation.folio
                            ? "Folio dibatalkan"
                            : "Belum check-in"}
                        </span>
                      ) : (
                        formatIDR(roundedFolioBalance(balance))
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/app/fo/reservasi/${reservation.id}`}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700 transition-colors hover:text-slate-950"
                      >
                        Buka
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Ringkasan grup
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Ringkasan tampilan saja; setiap kamar tetap dikelola sebagai
            reservasi dan folio terpisah.
          </p>
        </div>
        <div className="grid gap-4 px-5 py-5 md:grid-cols-2 xl:grid-cols-5">
          <SummaryMetric label="Total kamar" value={reservations.length} />
          <SummaryMetric label="Belum check-in" value={confirmedCount} />
          <SummaryMetric label="Sudah check-in" value={checkedInCount} />
          <SummaryMetric label="Sudah check-out" value={checkedOutCount} />
          {inactiveCount > 0 ? (
            <SummaryMetric label="Dibatalkan / no-show" value={inactiveCount} />
          ) : null}
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 md:col-span-2 xl:col-span-1">
            <p className="text-xs font-semibold text-emerald-800">
              Total saldo grup
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-emerald-950">
              {formatIDR(totalGroupBalance)}
            </p>
            <p className="mt-1 text-xs leading-4 text-emerald-800">
              Jumlah saldo dari {balances.length} folio per kamar.
            </p>
          </div>
        </div>
        <div className="border-t border-slate-100 px-5 py-4 text-sm text-slate-600">
          <p>
            Total saldo grup adalah penjumlahan saldo folio per kamar—bukan
            saldo dari folio bersama.
          </p>
          {roomsWithoutFolio > 0 ? (
            <p className="mt-1">
              {roomsWithoutFolio} kamar belum memiliki folio dan tidak
              termasuk dalam jumlah saldo.
            </p>
          ) : null}
          {roomsWithVoidedFolio > 0 ? (
            <p className="mt-1">
              {roomsWithVoidedFolio} folio dibatalkan dan tidak termasuk dalam
              jumlah saldo.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">
        {value}
      </p>
    </div>
  );
}
