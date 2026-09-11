import {
  ArticleType,
  FBOrderStatus,
  PaymentMethod,
  Prisma,
} from "@prisma/client";

import {
  addDateOnlyDays,
  hotelTimestampBoundaryForDate,
  hotelTodayISO,
  isValidISODateOnly,
  parseISODateOnly,
} from "@/lib/date-only";
import { formatISODate } from "@/lib/format";
import { computeFolioTotals } from "@/lib/folio-totals";
import { createCsvResponse, generateCsv, type CsvColumn } from "@/lib/csv";
import { prisma } from "@/lib/prisma";

export type AccountingExportRow = {
  invoice: string;
  date: Date;
  party: string | null;
  roomNumber: string | null;
  roomRevenue: number;
  fbRevenue: number;
  otherRevenue: number;
  subtotal: number;
  tax: number;
  total: number;
};

export type AccountingExportRange = {
  from: string;
  to: string;
  fromTimestamp: Date;
  toTimestamp: Date;
  fromDate: Date;
  toDateExclusive: Date;
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: "Tunai",
  TRANSFER: "Transfer",
  CARD: "Kartu",
  CHARGE_TO_ROOM: "Dibebankan ke kamar",
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

  const fromDate = parseISODateOnly(normalizedFrom);
  const toDateExclusive = parseISODateOnly(dateAfter(normalizedTo));

  return {
    from: normalizedFrom,
    to: normalizedTo,
    fromTimestamp: hotelTimestampBoundaryForDate(normalizedFrom),
    toTimestamp: hotelTimestampBoundaryForDate(dateAfter(normalizedTo)),
    fromDate,
    toDateExclusive,
  };
}

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  return Number(value ?? 0);
}

function isRoomChargeLine(line: {
  article: { code: string; type: ArticleType };
}) {
  return line.article.code === "ROOM-CHARGE" || line.article.type === ArticleType.ROOM;
}

function lineDate(line: {
  postedAt: Date;
  reservationNight: { date: Date } | null;
}) {
  return line.reservationNight?.date ?? line.postedAt;
}

type ExportLine = Prisma.FolioLineItemGetPayload<{
  select: {
    id: true;
    postedAt: true;
    amount: true;
    article: { select: { code: true; type: true } };
    reservationNight: { select: { date: true } };
    fbOrder: {
      select: {
        id: true;
        subtotal: true;
        serviceCharge: true;
        tax: true;
        total: true;
      };
    };
  };
}>;

function createFolioRow(
  folio: {
    folioNo: string;
    reservation: {
      guest: { fullName: string };
      room: { number: string } | null;
    };
  },
  lines: ExportLine[],
  settings: {
    taxPercent: Prisma.Decimal;
    serviceChargePercent: Prisma.Decimal;
  },
): AccountingExportRow {
  const linkedOrders = new Map<number, NonNullable<ExportLine["fbOrder"]>>();
  const folioLines = lines.filter((line) => {
    if (!line.fbOrder) return true;
    if (!linkedOrders.has(line.fbOrder.id)) linkedOrders.set(line.fbOrder.id, line.fbOrder);
    return false;
  });
  const roomRevenue = folioLines
    .filter(isRoomChargeLine)
    .reduce((sum, line) => sum + toNumber(line.amount), 0);
  const fbLineRevenue = folioLines
    .filter((line) => line.article.type === ArticleType.FB)
    .reduce((sum, line) => sum + toNumber(line.amount), 0);
  const otherLineRevenue = folioLines
    .filter(
      (line) =>
        !isRoomChargeLine(line) &&
        line.article.type !== ArticleType.FB &&
        line.article.type !== ArticleType.TAX &&
        line.article.type !== ArticleType.SERVICE,
    )
    .reduce((sum, line) => sum + toNumber(line.amount), 0);
  const explicitTax = folioLines
    .filter((line) => line.article.type === ArticleType.TAX)
    .reduce((sum, line) => sum + toNumber(line.amount), 0);
  const serviceLines = folioLines
    .filter((line) => line.article.type === ArticleType.SERVICE)
    .reduce((sum, line) => sum + toNumber(line.amount), 0);
  const linkedOrderTotals = [...linkedOrders.values()].reduce(
    (totals, order) => ({
      fbRevenue: totals.fbRevenue + toNumber(order.subtotal),
      serviceCharge: totals.serviceCharge + toNumber(order.serviceCharge),
      tax: totals.tax + toNumber(order.tax),
    }),
    { fbRevenue: 0, serviceCharge: 0, tax: 0 },
  );
  const nonLinkedLines = folioLines.filter((line) => !line.fbOrder);
  const canonicalTotals = computeFolioTotals(
    nonLinkedLines.map((line) => ({
      ...line,
      folioId: 0,
      articleId: 0,
      fbOrderId: null,
      reservationNightId: null,
      description: "",
      quantity: new Prisma.Decimal(1),
      unitPrice: line.amount,
      postedById: 0,
      postedAt: line.postedAt,
      folio: undefined,
      article: {
        id: 0,
        code: line.article.code,
        name: line.article.code,
        type: line.article.type,
        defaultPrice: null,
      },
    })) as Parameters<typeof computeFolioTotals>[0],
    [],
    settings as Parameters<typeof computeFolioTotals>[2],
  );
  const fbRevenue = fbLineRevenue + linkedOrderTotals.fbRevenue;
  const otherRevenue =
    otherLineRevenue +
    serviceLines +
    linkedOrderTotals.serviceCharge +
    canonicalTotals.serviceCharge;
  const tax = explicitTax > 0 ? explicitTax : canonicalTotals.tax + linkedOrderTotals.tax;
  const subtotal = roomRevenue + fbRevenue + otherRevenue;
  const total = subtotal + tax;
  const firstLine = [...lines].sort(
    (left, right) => lineDate(left).getTime() - lineDate(right).getTime(),
  )[0];

  return {
    invoice: folio.folioNo,
    date: firstLine ? lineDate(firstLine) : new Date(0),
    party: folio.reservation.guest.fullName,
    roomNumber: folio.reservation.room?.number ?? null,
    roomRevenue,
    fbRevenue,
    otherRevenue,
    subtotal,
    tax,
    total,
  };
}

export async function getAccountingExportRows(
  range: AccountingExportRange,
): Promise<AccountingExportRow[]> {
  const lineItemFilter: Prisma.FolioLineItemWhereInput = {
    OR: [
      {
        article: { code: "ROOM-CHARGE" },
        reservationNight: { date: { gte: range.fromDate, lt: range.toDateExclusive } },
      },
      {
        article: { code: { not: "ROOM-CHARGE" } },
        postedAt: { gte: range.fromTimestamp, lt: range.toTimestamp },
      },
    ],
  };
  const [folios, standaloneOrders, settings] = await Promise.all([
    prisma.folio.findMany({
      where: { lineItems: { some: lineItemFilter } },
      select: {
        folioNo: true,
        reservation: {
          select: {
            guest: { select: { fullName: true } },
            room: { select: { number: true } },
          },
        },
        lineItems: {
          where: lineItemFilter,
          select: {
            id: true,
            postedAt: true,
            amount: true,
            article: { select: { code: true, type: true } },
            reservationNight: { select: { date: true } },
            fbOrder: {
              select: {
                id: true,
                subtotal: true,
                serviceCharge: true,
                tax: true,
                total: true,
              },
            },
          },
        },
      },
    }),
    prisma.fBOrder.findMany({
      where: {
        status: FBOrderStatus.CLOSED,
        chargedFolioId: null,
        closedAt: { gte: range.fromTimestamp, lt: range.toTimestamp },
      },
      select: {
        orderNo: true,
        closedAt: true,
        subtotal: true,
        serviceCharge: true,
        tax: true,
        total: true,
      },
    }),
    prisma.hotelSettings.findUniqueOrThrow({ where: { id: 1 } }),
  ]);

  const folioRows = folios.map((folio) =>
    createFolioRow(folio, folio.lineItems, settings),
  );
  const orderRows = standaloneOrders.map((order) => ({
    invoice: order.orderNo,
    date: order.closedAt ?? new Date(0),
    party: null,
    roomNumber: null,
    roomRevenue: 0,
    fbRevenue: toNumber(order.subtotal),
    otherRevenue: toNumber(order.serviceCharge),
    subtotal: toNumber(order.subtotal) + toNumber(order.serviceCharge),
    tax: toNumber(order.tax),
    total: toNumber(order.total),
  } satisfies AccountingExportRow));

  return [...folioRows, ...orderRows].sort(
    (left, right) => left.date.getTime() - right.date.getTime() || left.invoice.localeCompare(right.invoice),
  );
}

export const accountingExportCsvColumns: CsvColumn<AccountingExportRow>[] = [
  { header: "Invoice", accessor: (row) => row.invoice },
  { header: "Tanggal", accessor: (row) => formatISODate(row.date) },
  { header: "Tamu / Party", accessor: (row) => row.party },
  { header: "Kamar", accessor: (row) => row.roomNumber },
  { header: "Pendapatan Kamar (Rp)", accessor: (row) => row.roomRevenue },
  { header: "Pendapatan F&B (Rp)", accessor: (row) => row.fbRevenue },
  { header: "Pendapatan Lain (Rp)", accessor: (row) => row.otherRevenue },
  { header: "Subtotal (Rp)", accessor: (row) => row.subtotal },
  { header: "Pajak (Rp)", accessor: (row) => row.tax },
  { header: "Total (Rp)", accessor: (row) => row.total },
];

export function createAccountingExportCsv(rows: AccountingExportRow[], filename: string) {
  return createCsvResponse(generateCsv(accountingExportCsvColumns, rows), filename);
}
