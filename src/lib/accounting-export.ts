import { ArticleType, PaymentMethod, PaymentPurpose } from "@prisma/client";

import {
  addDateOnlyDays,
  hotelTimestampBoundaryForDate,
  hotelTodayISO,
  isValidISODateOnly,
  parseISODateOnly,
} from "@/lib/date-only";
import { formatISODate } from "@/lib/format";
import { createCsvResponse, generateCsv, type CsvColumn } from "@/lib/csv";
import { prisma } from "@/lib/prisma";

export type AccountingExportRow = {
  id: string;
  date: Date;
  transactionType: string;
  reservationNo: string | null;
  guestName: string | null;
  roomNumber: string | null;
  roomRevenue: number;
  fbRevenue: number;
  tax: number;
  total: number;
  paymentMethod: string | null;
  status: string;
};

export type AccountingExportRange = {
  from: string;
  to: string;
  fromTimestamp: Date;
  toTimestamp: Date;
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: "Tunai",
  TRANSFER: "Transfer",
  CARD: "Kartu",
  CHARGE_TO_ROOM: "Dibebankan ke kamar",
};

const paymentPurposeLabels: Record<PaymentPurpose, string> = {
  DEPOSIT: "Deposit",
  PAYMENT: "Pembayaran",
  SETTLEMENT: "Pelunasan",
};

function dateAfter(value: string): string {
  return formatISODate(addDateOnlyDays(parseISODateOnly(value), 1));
}

export function getAccountingExportRange(
  from: string | undefined,
  to: string | undefined,
): AccountingExportRange {
  const today = hotelTodayISO();
  const defaultFrom = `${today.slice(0, 8)}01`;
  const normalizedFrom = from && isValidISODateOnly(from) ? from : defaultFrom;
  const normalizedTo = to && isValidISODateOnly(to) ? to : today;

  if (normalizedFrom > normalizedTo) {
    throw new RangeError("Tanggal awal harus sama atau sebelum tanggal akhir.");
  }

  return {
    from: normalizedFrom,
    to: normalizedTo,
    fromTimestamp: hotelTimestampBoundaryForDate(normalizedFrom),
    toTimestamp: hotelTimestampBoundaryForDate(dateAfter(normalizedTo)),
  };
}

function classifyLineItem(type: ArticleType, amount: number) {
  return {
    roomRevenue: type === ArticleType.ROOM ? amount : 0,
    fbRevenue: type === ArticleType.FB ? amount : 0,
    tax: type === ArticleType.TAX ? amount : 0,
    transactionType:
      type === ArticleType.ROOM
        ? "Pendapatan Kamar"
        : type === ArticleType.FB
          ? "Pendapatan F&B"
          : type === ArticleType.TAX
            ? "Pajak"
            : type === ArticleType.SERVICE
              ? "Biaya Layanan"
              : "Pendapatan Lain",
  };
}

export async function getAccountingExportRows(
  range: AccountingExportRange,
): Promise<AccountingExportRow[]> {
  const [lineItems, payments] = await Promise.all([
    prisma.folioLineItem.findMany({
      where: {
        postedAt: { gte: range.fromTimestamp, lt: range.toTimestamp },
      },
      select: {
        id: true,
        postedAt: true,
        description: true,
        amount: true,
        article: { select: { type: true } },
        folio: {
          select: {
            reservation: {
              select: {
                reservationNo: true,
                guest: { select: { fullName: true } },
                room: { select: { number: true } },
              },
            },
          },
        },
      },
      orderBy: [{ postedAt: "asc" }, { id: "asc" }],
    }),
    prisma.payment.findMany({
      where: {
        receivedAt: { gte: range.fromTimestamp, lt: range.toTimestamp },
      },
      select: {
        id: true,
        receivedAt: true,
        amount: true,
        method: true,
        purpose: true,
        folio: {
          select: {
            reservation: {
              select: {
                reservationNo: true,
                guest: { select: { fullName: true } },
                room: { select: { number: true } },
              },
            },
          },
        },
        fbOrder: {
          select: {
            chargedFolio: {
              select: {
                reservation: {
                  select: {
                    reservationNo: true,
                    guest: { select: { fullName: true } },
                    room: { select: { number: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
    }),
  ]);

  const chargeRows = lineItems.map((lineItem) => {
    const amount = Number(lineItem.amount);
    const classification = classifyLineItem(lineItem.article.type, amount);
    return {
      id: `LI-${lineItem.id}`,
      date: lineItem.postedAt,
      transactionType: classification.transactionType,
      reservationNo: lineItem.folio.reservation.reservationNo,
      guestName: lineItem.folio.reservation.guest.fullName,
      roomNumber: lineItem.folio.reservation.room?.number ?? null,
      roomRevenue: classification.roomRevenue,
      fbRevenue: classification.fbRevenue,
      tax: classification.tax,
      total: amount,
      paymentMethod: null,
      status: "Tercatat",
    } satisfies AccountingExportRow;
  });

  const paymentRows = payments.map((payment) => {
    const reservation =
      payment.folio?.reservation ?? payment.fbOrder?.chargedFolio?.reservation;
    const amount = Number(payment.amount);
    return {
      id: `PAY-${payment.id}`,
      date: payment.receivedAt,
      transactionType: paymentPurposeLabels[payment.purpose],
      reservationNo: reservation?.reservationNo ?? null,
      guestName: reservation?.guest.fullName ?? null,
      roomNumber: reservation?.room?.number ?? null,
      roomRevenue: 0,
      fbRevenue: 0,
      tax: 0,
      total: amount,
      paymentMethod: paymentMethodLabels[payment.method],
      status: "Diterima",
    } satisfies AccountingExportRow;
  });

  return [...chargeRows, ...paymentRows].sort(
    (left, right) => left.date.getTime() - right.date.getTime() || left.id.localeCompare(right.id),
  );
}

export const accountingExportCsvColumns: CsvColumn<AccountingExportRow>[] = [
  { header: "ID Transaksi", accessor: (row) => row.id },
  { header: "Tanggal", accessor: (row) => formatISODate(row.date) },
  { header: "Tipe Transaksi", accessor: (row) => row.transactionType },
  { header: "No. Reservasi", accessor: (row) => row.reservationNo },
  { header: "Tamu", accessor: (row) => row.guestName },
  { header: "Kamar", accessor: (row) => row.roomNumber },
  { header: "Pendapatan Kamar (Rp)", accessor: (row) => row.roomRevenue },
  { header: "Pendapatan F&B (Rp)", accessor: (row) => row.fbRevenue },
  { header: "Pajak (Rp)", accessor: (row) => row.tax },
  { header: "Total (Rp)", accessor: (row) => row.total },
  { header: "Metode Pembayaran", accessor: (row) => row.paymentMethod },
  { header: "Status", accessor: (row) => row.status },
];

export function createAccountingExportCsv(rows: AccountingExportRow[], filename: string) {
  return createCsvResponse(generateCsv(accountingExportCsvColumns, rows), filename);
}