import type { ReservationStatus } from "@prisma/client";

import { auth } from "@/auth";
import { createCsvResponse, generateCsv, type CsvColumn } from "@/lib/csv";
import { hotelTodayISO } from "@/lib/date-only";
import { flatReservationNightSummaryTotal } from "@/lib/flat-reservation-night-total";
import { roundedFolioBalance } from "@/lib/folio-balance-display";
import { computeFolioTotals } from "@/lib/folio-totals";
import { formatISODate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

import { buildReservationListWhere, parseReservationListParams } from "../(views)/list/query";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<ReservationStatus, string> = {
  CONFIRMED: "Terkonfirmasi",
  CHECKED_IN: "Sudah check-in",
  CHECKED_OUT: "Sudah check-out",
  CANCELLED: "Dibatalkan",
  NO_SHOW: "No-show",
};

type ReservationCsvRow = {
  reservationNo: string;
  guestName: string;
  phone: string | null;
  email: string | null;
  status: ReservationStatus;
  roomNumber: string | null;
  roomTypeName: string;
  guests: string;
  arrivalDate: Date;
  departureDate: Date;
  createdAt: Date;
  total: number;
  outstanding: number | null;
  groupLabel: string | null;
};

function guestCountLabel(adults: number, children: number): string {
  return children > 0
    ? `${adults} dewasa, ${children} anak`
    : `${adults} dewasa`;
}

const CSV_COLUMNS: CsvColumn<ReservationCsvRow>[] = [
  { header: "Nomor Reservasi", accessor: (row) => row.reservationNo },
  { header: "Nama Tamu", accessor: (row) => row.guestName },
  { header: "Nomor Telepon", accessor: (row) => row.phone },
  { header: "Email", accessor: (row) => row.email },
  { header: "Status", accessor: (row) => STATUS_LABELS[row.status] },
  { header: "Kamar", accessor: (row) => row.roomNumber },
  { header: "Tipe Kamar", accessor: (row) => row.roomTypeName },
  { header: "Tamu", accessor: (row) => row.guests },
  { header: "Check-in", accessor: (row) => formatISODate(row.arrivalDate) },
  { header: "Check-out", accessor: (row) => formatISODate(row.departureDate) },
  { header: "Dibuat", accessor: (row) => row.createdAt },
  { header: "Total (Rp)", accessor: (row) => row.total },
  { header: "Saldo (Rp)", accessor: (row) => row.outstanding },
  { header: "Grup", accessor: (row) => row.groupLabel },
];

export async function GET(req: Request) {
  const session = await auth();

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!["FO", "ADMIN"].includes(session.user.role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const searchParams = new URL(req.url).searchParams;
  const filters = parseReservationListParams(
    Object.fromEntries(
      Array.from(new Set(searchParams.keys()), (key) => [key, searchParams.getAll(key)]),
    ),
  );
  const where = buildReservationListWhere(filters);

  const [reservations, settings] = await Promise.all([
    prisma.reservation.findMany({
      where,
      include: {
        guest: { select: { fullName: true, phone: true, email: true } },
        room: { select: { number: true } },
        roomType: { select: { name: true } },
        folio: {
          include: {
            lineItems: { include: { article: true } },
            payments: true,
          },
        },
      },
      orderBy: [{ arrivalDate: "asc" }, { guest: { fullName: "asc" } }],
    }),
    prisma.hotelSettings.findUniqueOrThrow({ where: { id: 1 } }),
  ]);

  const reservationIds = reservations.map((reservation) => reservation.id);
  const groupBookingIds = Array.from(
    new Set(
      reservations.flatMap((reservation) =>
        reservation.groupBookingId ? [reservation.groupBookingId] : [],
      ),
    ),
  );
  const [nightlyTotals, groupCounts] = await Promise.all([
    reservationIds.length
      ? prisma.reservationNight.groupBy({
          by: ["reservationId"],
          where: { reservationId: { in: reservationIds } },
          _count: { _all: true },
          _sum: { rateAmount: true },
          _min: { date: true },
          _max: { date: true },
        })
      : [],
    groupBookingIds.length
      ? prisma.reservation.groupBy({
          by: ["groupBookingId"],
          where: { groupBookingId: { in: groupBookingIds } },
          _count: { _all: true },
        })
      : [],
  ]);
  const nightlyTotalByReservationId = new Map(
    nightlyTotals.map((total) => [total.reservationId, total]),
  );
  const groupCountById = new Map(
    groupCounts.flatMap((group) =>
      group.groupBookingId
        ? [[group.groupBookingId, group._count._all] as const]
        : [],
    ),
  );

  const rows: ReservationCsvRow[] = reservations.map((reservation) => {
    const nightlySummary = nightlyTotalByReservationId.get(reservation.id);
    const total = Number(
      flatReservationNightSummaryTotal({
        arrivalDate: reservation.arrivalDate,
        departureDate: reservation.departureDate,
        rateAmount: reservation.rateAmount,
        summary: nightlySummary
          ? {
              count: nightlySummary._count._all,
              total: nightlySummary._sum.rateAmount,
              firstDate: nightlySummary._min.date,
              lastDate: nightlySummary._max.date,
            }
          : undefined,
      }).toString(),
    );
    const outstanding = reservation.folio
      ? roundedFolioBalance(
          computeFolioTotals(
            reservation.folio.lineItems,
            reservation.folio.payments,
            settings,
          ).balance,
        )
      : null;
    const groupLabel = reservation.groupBookingId
      ? `${reservation.groupBookingId} (${groupCountById.get(reservation.groupBookingId) ?? 1} kamar)`
      : null;

    return {
      reservationNo: reservation.reservationNo,
      guestName: reservation.guest.fullName,
      phone: reservation.guest.phone,
      email: reservation.guest.email,
      status: reservation.status,
      roomNumber: reservation.room?.number ?? null,
      roomTypeName: reservation.roomType.name,
      guests: guestCountLabel(reservation.adults, reservation.children),
      arrivalDate: reservation.arrivalDate,
      departureDate: reservation.departureDate,
      createdAt: reservation.createdAt,
      total,
      outstanding,
      groupLabel,
    };
  });

  const csv = generateCsv(CSV_COLUMNS, rows);
  return createCsvResponse(csv, `reservasi-${hotelTodayISO()}.csv`);
}
