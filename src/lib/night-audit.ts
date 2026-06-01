import {
  ArrangementType,
  FBOrderStatus,
  FolioStatus,
  Prisma,
  ReservationStatus,
  RoomStatus,
} from "@prisma/client";
import { addDays } from "date-fns";

import { dateOnlyBoundary, hotelTodayTimestampRange } from "@/lib/date-only";
import { formatISODate, formatLongDateID } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const NIGHT_AUDIT_POSTING_ARTICLE_CODES = [
  "ROOM-CHARGE",
  "BREAKFAST",
  "COFFEE-BREAK",
  "LUNCH",
  "DINNER",
] as const;

export type NightAuditPostingArticleCode =
  (typeof NIGHT_AUDIT_POSTING_ARTICLE_CODES)[number];

const ARRANGEMENT_INCLUSION_CODES: Record<
  ArrangementType,
  NightAuditPostingArticleCode[]
> = {
  [ArrangementType.RO]: [],
  [ArrangementType.RB]: ["BREAKFAST"],
  [ArrangementType.FBM]: ["BREAKFAST", "COFFEE-BREAK", "LUNCH", "DINNER"],
};

const ZERO = new Prisma.Decimal(0);
const ONE = new Prisma.Decimal(1);

type NightAuditReservation = {
  id: number;
  reservationNo: string;
  arrangementType: ArrangementType;
  rateAmount: Prisma.Decimal | null;
  guest: { fullName: string };
  room: { number: string } | null;
  folio: { id: number; folioNo: string; status: FolioStatus } | null;
};

export type NightAuditLineItemInput = {
  folioId: number;
  articleId: number;
  fbOrderId: null;
  description: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  amount: Prisma.Decimal;
  postedById: number;
  postedAt: Date;
};

export type NightAuditSnapshotInput = {
  businessDate: Date;
  runById: number;
  totalRooms: number;
  roomsOccupied: number;
  occupancyRate: Prisma.Decimal;
  roomRevenue: Prisma.Decimal;
  fbRevenue: Prisma.Decimal;
  otherRevenue: Prisma.Decimal;
  totalRevenue: Prisma.Decimal;
  checkInCount: number;
  checkOutCount: number;
  inHouseCount: number;
};

export type NightAuditPostingArticlePreview = {
  code: NightAuditPostingArticleCode;
  name: string;
  amountSource: "reservation-rate" | "article-price";
  amount: string | null;
};

export type NightAuditPreviewReservation = {
  id: number;
  reservationNo: string;
  guestName: string;
  roomNumber: string;
  folioNo: string;
  arrangementType: ArrangementType;
  rateAmount: string;
  lineItemCount: number;
  postingTotal: string;
};

export type NightAuditPlan = {
  businessDate: Date;
  businessDateLabel: string;
  timestampStart: Date;
  timestampEnd: Date;
  existingAudit: {
    id: number;
    runAt: Date;
    runByName: string;
    roomRevenue: string;
    fbRevenue: string;
    otherRevenue: string;
    totalRevenue: string;
    roomsOccupied: number;
    totalRooms: number;
    occupancyRate: string;
    inHouseCount: number;
  } | null;
  openFbOrderCount: number;
  arrangementBreakdown: Record<ArrangementType, number>;
  inHouseCount: number;
  lineItemCount: number;
  roomChargeCount: number;
  inclusionCount: number;
  roomRevenue: string;
  fbInclusionRevenue: string;
  closedFbRevenue: string;
  fbRevenue: string;
  otherRevenue: string;
  totalRevenue: string;
  metrics: {
    totalRooms: number;
    roomsOccupied: number;
    occupancyRate: string;
    checkInCount: number;
    checkOutCount: number;
    inHouseCount: number;
  };
  postingArticles: NightAuditPostingArticlePreview[];
  reservations: NightAuditPreviewReservation[];
  warnings: string[];
  blockingErrors: string[];
  lineItemsToCreate: NightAuditLineItemInput[];
  snapshot: NightAuditSnapshotInput;
  affectedFolioIds: number[];
  affectedReservationIds: number[];
};

function businessDateLabel(date: Date) {
  return formatLongDateID(date);
}

function decimal(
  value: Prisma.Decimal | number | string | null | undefined,
): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) {
    return value;
  }

  return new Prisma.Decimal(value ?? 0);
}

function addDecimal(
  values: Array<Prisma.Decimal | number | string | null | undefined>,
): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>(
    (sum, value) => sum.plus(decimal(value)),
    new Prisma.Decimal(0),
  );
}

function safeRateAmount(reservation: NightAuditReservation) {
  const rate = decimal(reservation.rateAmount);

  if (rate.lt(0)) {
    return ZERO;
  }

  return rate;
}

function occupancyRate(roomsOccupied: number, totalRooms: number) {
  if (totalRooms === 0) {
    return ZERO;
  }

  return new Prisma.Decimal(roomsOccupied)
    .mul(100)
    .div(totalRooms)
    .toDecimalPlaces(2);
}

function validatePostingArticles(
  articles: Awaited<ReturnType<typeof prisma.article.findMany>>,
) {
  const articleByCode = new Map(articles.map((article) => [article.code, article]));
  const blockingErrors: string[] = [];

  for (const code of NIGHT_AUDIT_POSTING_ARTICLE_CODES) {
    if (!articleByCode.has(code)) {
      blockingErrors.push(`Artikel posting ${code} belum tersedia.`);
    }
  }

  for (const code of ARRANGEMENT_INCLUSION_CODES[ArrangementType.FBM]) {
    const article = articleByCode.get(code);

    if (article && article.defaultPrice === null) {
      blockingErrors.push(`Artikel ${code} belum memiliki default price.`);
    }
  }

  return { articleByCode, blockingErrors };
}

function buildPostingArticlesPreview(
  articleByCode: Map<string, Awaited<ReturnType<typeof prisma.article.findMany>>[number]>,
): NightAuditPostingArticlePreview[] {
  return NIGHT_AUDIT_POSTING_ARTICLE_CODES.map((code) => {
    const article = articleByCode.get(code);

    return {
      code,
      name: article?.name ?? code,
      amountSource:
        code === "ROOM-CHARGE" ? "reservation-rate" : "article-price",
      amount:
        code === "ROOM-CHARGE"
          ? null
          : (article?.defaultPrice?.toString() ?? null),
    };
  });
}

function validateReservations(reservations: NightAuditReservation[]) {
  const blockingErrors: string[] = [];
  const warnings: string[] = [];

  for (const reservation of reservations) {
    if (!reservation.folio) {
      blockingErrors.push(
        `Reservasi ${reservation.reservationNo} belum memiliki folio.`,
      );
      continue;
    }

    if (reservation.folio.status !== FolioStatus.OPEN) {
      blockingErrors.push(
        `Folio ${reservation.folio.folioNo} untuk ${reservation.reservationNo} tidak OPEN.`,
      );
    }

    const rawRate = decimal(reservation.rateAmount);

    if (reservation.rateAmount === null || rawRate.eq(0)) {
      warnings.push(
        `Reservasi ${reservation.reservationNo} memiliki rate 0; room charge akan diposting Rp 0.`,
      );
    } else if (rawRate.lt(0)) {
      warnings.push(
        `Reservasi ${reservation.reservationNo} memiliki rate negatif; room charge diperlakukan Rp 0.`,
      );
    }
  }

  return { blockingErrors, warnings };
}

function buildLineItems({
  reservations,
  articleByCode,
  postedById,
  postedAt,
  label,
}: {
  reservations: NightAuditReservation[];
  articleByCode: Map<string, Awaited<ReturnType<typeof prisma.article.findMany>>[number]>;
  postedById: number;
  postedAt: Date;
  label: string;
}) {
  const lineItems: NightAuditLineItemInput[] = [];
  const previews: NightAuditPreviewReservation[] = [];

  const roomChargeArticle = articleByCode.get("ROOM-CHARGE");

  if (!roomChargeArticle) {
    return { lineItems, previews };
  }

  for (const reservation of reservations) {
    if (!reservation.folio || reservation.folio.status !== FolioStatus.OPEN) {
      continue;
    }

    const folio = reservation.folio;
    const reservationLineItems: NightAuditLineItemInput[] = [];
    const roomCharge = safeRateAmount(reservation);

    reservationLineItems.push({
      folioId: folio.id,
      articleId: roomChargeArticle.id,
      fbOrderId: null,
      description: `Night Audit Room Charge - ${label}`,
      quantity: ONE,
      unitPrice: roomCharge,
      amount: roomCharge,
      postedById,
      postedAt,
    });

    for (const code of ARRANGEMENT_INCLUSION_CODES[reservation.arrangementType]) {
      const article = articleByCode.get(code);

      if (!article || article.defaultPrice === null) {
        continue;
      }

      const amount = decimal(article.defaultPrice);

      reservationLineItems.push({
        folioId: folio.id,
        articleId: article.id,
        fbOrderId: null,
        description: `Night Audit ${article.name} Inclusion - ${label}`,
        quantity: ONE,
        unitPrice: amount,
        amount,
        postedById,
        postedAt,
      });
    }

    lineItems.push(...reservationLineItems);
    previews.push({
      id: reservation.id,
      reservationNo: reservation.reservationNo,
      guestName: reservation.guest.fullName,
      roomNumber: reservation.room?.number ?? "-",
      folioNo: folio.folioNo,
      arrangementType: reservation.arrangementType,
      rateAmount: roomCharge.toString(),
      lineItemCount: reservationLineItems.length,
      postingTotal: addDecimal(
        reservationLineItems.map((lineItem) => lineItem.amount),
      ).toString(),
    });
  }

  return { lineItems, previews };
}

export async function buildNightAuditPlan({
  runById,
  now = new Date(),
}: {
  runById: number;
  now?: Date;
}): Promise<NightAuditPlan> {
  const businessDate = dateOnlyBoundary(now);
  const nextBusinessDate = addDays(businessDate, 1);
  // Snapshot windows follow the live WIB calendar day. The audit business date
  // above is deliberately separate and must retain its own advancement logic.
  const { start: timestampStart, end: timestampEnd } =
    hotelTodayTimestampRange(now);
  const postingLabel = formatISODate(dateOnlyBoundary(now));

  const [
    existingAudit,
    reservations,
    articles,
    openFbOrderCount,
    totalRooms,
    roomsOccupied,
    checkInCount,
    checkOutCount,
    closedFbRevenue,
    otherFolioRevenue,
  ] = await Promise.all([
    prisma.nightAudit.findUnique({
      where: { businessDate },
      include: { runBy: { select: { fullName: true } } },
    }),
    prisma.reservation.findMany({
      where: { status: ReservationStatus.CHECKED_IN },
      orderBy: { reservationNo: "asc" },
      select: {
        id: true,
        reservationNo: true,
        arrangementType: true,
        rateAmount: true,
        guest: { select: { fullName: true } },
        room: { select: { number: true } },
        folio: { select: { id: true, folioNo: true, status: true } },
      },
    }),
    prisma.article.findMany({
      where: { code: { in: [...NIGHT_AUDIT_POSTING_ARTICLE_CODES] } },
      orderBy: { code: "asc" },
    }),
    prisma.fBOrder.count({
      where: { status: FBOrderStatus.OPEN },
    }),
    prisma.room.count(),
    prisma.room.count({
      where: { status: { in: [RoomStatus.OC, RoomStatus.OD] } },
    }),
    prisma.reservation.count({
      where: {
        arrivalDate: { gte: businessDate, lt: nextBusinessDate },
        status: {
          notIn: [ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW],
        },
      },
    }),
    prisma.reservation.count({
      where: {
        departureDate: { gte: businessDate, lt: nextBusinessDate },
        status: {
          notIn: [ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW],
        },
      },
    }),
    prisma.fBOrder.aggregate({
      where: {
        status: FBOrderStatus.CLOSED,
        closedAt: { gte: timestampStart, lt: timestampEnd },
      },
      _sum: { total: true },
    }),
    prisma.folioLineItem.aggregate({
      where: {
        postedAt: { gte: timestampStart, lt: timestampEnd },
        fbOrderId: null,
      },
      _sum: { amount: true },
    }),
  ]);

  const { articleByCode, blockingErrors: articleErrors } =
    validatePostingArticles(articles);
  const { blockingErrors: reservationErrors, warnings: reservationWarnings } =
    validateReservations(reservations);
  const { lineItems, previews } = buildLineItems({
    reservations,
    articleByCode,
    postedById: runById,
    postedAt: now,
    label: postingLabel,
  });

  const roomRevenue = addDecimal(
    lineItems
      .filter(
        (lineItem) => lineItem.articleId === articleByCode.get("ROOM-CHARGE")?.id,
      )
      .map((lineItem) => lineItem.amount),
  );
  const fbInclusionRevenue = addDecimal(
    lineItems
      .filter(
        (lineItem) => lineItem.articleId !== articleByCode.get("ROOM-CHARGE")?.id,
      )
      .map((lineItem) => lineItem.amount),
  );
  const closedFbOrderRevenue = decimal(closedFbRevenue._sum.total);
  const fbRevenue = fbInclusionRevenue.plus(closedFbOrderRevenue);
  const otherRevenue = decimal(otherFolioRevenue._sum.amount);
  const totalRevenue = roomRevenue.plus(fbRevenue).plus(otherRevenue);
  const computedOccupancyRate = occupancyRate(roomsOccupied, totalRooms);
  const arrangementBreakdown = {
    [ArrangementType.RO]: 0,
    [ArrangementType.RB]: 0,
    [ArrangementType.FBM]: 0,
  };

  for (const reservation of reservations) {
    arrangementBreakdown[reservation.arrangementType] += 1;
  }

  const warnings = [...reservationWarnings];

  if (openFbOrderCount > 0) {
    warnings.push(
      `${openFbOrderCount} order F&B masih terbuka - pertimbangkan untuk menyelesaikan dulu.`,
    );
  }

  const affectedFolioIds = [
    ...new Set(lineItems.map((lineItem) => lineItem.folioId)),
  ];
  const affectedReservationIds = [
    ...new Set(
      reservations
        .filter((reservation) =>
          affectedFolioIds.includes(reservation.folio?.id ?? -1),
        )
        .map((reservation) => reservation.id),
    ),
  ];

  return {
    businessDate,
    businessDateLabel: businessDateLabel(businessDate),
    timestampStart,
    timestampEnd,
    existingAudit: existingAudit
      ? {
          id: existingAudit.id,
          runAt: existingAudit.runAt,
          runByName: existingAudit.runBy.fullName,
          roomRevenue: existingAudit.roomRevenue.toString(),
          fbRevenue: existingAudit.fbRevenue.toString(),
          otherRevenue: existingAudit.otherRevenue.toString(),
          totalRevenue: existingAudit.totalRevenue.toString(),
          roomsOccupied: existingAudit.roomsOccupied,
          totalRooms: existingAudit.totalRooms,
          occupancyRate: existingAudit.occupancyRate.toString(),
          inHouseCount: existingAudit.inHouseCount,
        }
      : null,
    openFbOrderCount,
    arrangementBreakdown,
    inHouseCount: reservations.length,
    lineItemCount: lineItems.length,
    roomChargeCount: previews.length,
    inclusionCount: lineItems.length - previews.length,
    roomRevenue: roomRevenue.toString(),
    fbInclusionRevenue: fbInclusionRevenue.toString(),
    closedFbRevenue: closedFbOrderRevenue.toString(),
    fbRevenue: fbRevenue.toString(),
    otherRevenue: otherRevenue.toString(),
    totalRevenue: totalRevenue.toString(),
    metrics: {
      totalRooms,
      roomsOccupied,
      occupancyRate: computedOccupancyRate.toString(),
      checkInCount,
      checkOutCount,
      inHouseCount: reservations.length,
    },
    postingArticles: buildPostingArticlesPreview(articleByCode),
    reservations: previews,
    warnings,
    blockingErrors: [...articleErrors, ...reservationErrors],
    lineItemsToCreate: lineItems,
    snapshot: {
      businessDate,
      runById,
      totalRooms,
      roomsOccupied,
      occupancyRate: computedOccupancyRate,
      roomRevenue,
      fbRevenue,
      otherRevenue,
      totalRevenue,
      checkInCount,
      checkOutCount,
      inHouseCount: reservations.length,
    },
    affectedFolioIds,
    affectedReservationIds,
  };
}
