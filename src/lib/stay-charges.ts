import {
  type ArrangementType,
  Prisma,
  FolioStatus,
  type Article,
  type FolioLineItem,
  type ReservationNight,
  ReservationStatus,
} from "@prisma/client";
import { addDays, differenceInCalendarDays } from "date-fns";

import { ARRANGEMENT_INCLUSION_ARTICLE_CODES } from "@/lib/arrangement-inclusions";
import { dateOnlyBoundary, hotelTodayDateOnly } from "@/lib/date-only";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";

export const ROOM_CHARGE_ARTICLE_CODE = "ROOM-CHARGE";

/**
 * Article codes posted as nightly stay charges (room charge plus arrangement
 * inclusions). This is the single source of truth shared by the night audit
 * (which posts them each night) and check-out (which posts any the audit has
 * not yet posted for the nights already stayed).
 */
export const STAY_CHARGE_ARTICLE_CODES = [
  "ROOM-CHARGE",
  "BREAKFAST",
  "COFFEE-BREAK",
  "LUNCH",
  "DINNER",
] as const;

export type StayChargeArticleCode = (typeof STAY_CHARGE_ARTICLE_CODES)[number];

export type StayChargeArticle = Pick<
  Article,
  "id" | "code" | "name" | "type" | "defaultPrice"
>;

export type StayChargeReservationNight = Pick<
  ReservationNight,
  "id" | "reservationId" | "date" | "rateAmount"
>;

export type ExistingStayChargeLine = Pick<
  FolioLineItem,
  "articleId" | "fbOrderId" | "reservationNightId"
>;

export type PendingStayChargeLine = {
  reservationNightId: string;
  serviceDate: Date;
  articleId: number;
  article: StayChargeArticle;
  description: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  amount: Prisma.Decimal;
};

export class StayChargePostingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StayChargePostingError";
  }
}

const MAX_POSTING_ATTEMPTS = 3;

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function postingBlocked(reservationNo: string, detail: string): never {
  throw new StayChargePostingError(
    `Posting stay charge ${reservationNo} diblokir: ${detail}`,
  );
}

function validatePostingSchedule({
  reservationId,
  reservationNo,
  arrivalDate,
  departureDate,
  expectedNights,
  reservationNights,
}: {
  reservationId: number;
  reservationNo: string;
  arrivalDate: Date;
  departureDate: Date;
  expectedNights: number;
  reservationNights: StayChargeReservationNight[];
}) {
  const expectedDates: Date[] = [];
  const departure = dateOnlyBoundary(departureDate);

  for (
    let date = dateOnlyBoundary(arrivalDate);
    date < departure;
    date = addDays(date, 1)
  ) {
    expectedDates.push(date);
  }

  if (reservationNights.length !== expectedDates.length) {
    postingBlocked(
      reservationNo,
      `jadwal ReservationNight tidak lengkap (expected ${expectedDates.length}, actual ${reservationNights.length}).`,
    );
  }

  for (const [index, night] of reservationNights.entries()) {
    const expectedDate = expectedDates[index];

    if (!expectedDate || dateKey(night.date) !== dateKey(expectedDate)) {
      postingBlocked(
        reservationNo,
        `jadwal ReservationNight harus berurutan dan kontigu; posisi ${index + 1} expected ${expectedDate ? dateKey(expectedDate) : "none"}, actual ${dateKey(night.date)}.`,
      );
    }

    if (night.reservationId !== reservationId) {
      postingBlocked(
        reservationNo,
        `snapshot ${night.id} bukan milik reservasi ini.`,
      );
    }

    if (!night.rateAmount.isInteger() || night.rateAmount.isNegative()) {
      postingBlocked(
        reservationNo,
        `rate snapshot ${night.id} (${dateKey(night.date)}) harus whole-IDR dan tidak negatif.`,
      );
    }

  }

  if (!Number.isInteger(expectedNights) || expectedNights < 1) {
    postingBlocked(reservationNo, `expected nights tidak valid (${expectedNights}).`);
  }

  if (expectedNights > reservationNights.length) {
    postingBlocked(
      reservationNo,
      `membutuhkan ${expectedNights} malam tetapi hanya memiliki ${reservationNights.length} snapshot; perpanjang masa inap / buat snapshot terlebih dahulu.`,
    );
  }

  return reservationNights.slice(0, expectedNights);
}

function requiredArticles({
  reservationNo,
  arrangementType,
  articles,
}: {
  reservationNo: string;
  arrangementType: ArrangementType;
  articles: StayChargeArticle[];
}) {
  const articleByCode = new Map(articles.map((article) => [article.code, article]));
  const codes = [
    ROOM_CHARGE_ARTICLE_CODE,
    ...ARRANGEMENT_INCLUSION_ARTICLE_CODES[arrangementType],
  ];

  return codes.map((code) => {
    const article = articleByCode.get(code);

    if (!article) {
      postingBlocked(reservationNo, `artikel ${code} tidak tersedia.`);
    }

    if (code !== ROOM_CHARGE_ARTICLE_CODE && article.defaultPrice === null) {
      postingBlocked(reservationNo, `artikel ${code} belum memiliki default price.`);
    }

    return article;
  });
}

function isRetryablePostingConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2002")
  );
}

/**
 * Nights the guest is liable for by the check-out date. Mirrors the app's
 * established nights convention used elsewhere (folio header, housekeeping):
 * departure-day excluded, minimum one night. Computed against the hotel "today"
 * so a check-out that happens before the night audit still bills every night
 * already stayed.
 */
export function stayNightsThroughCheckout(
  arrivalDate: Date,
  now: Date = new Date(),
): number {
  return Math.max(
    1,
    differenceInCalendarDays(hotelTodayDateOnly(now), arrivalDate),
  );
}

/**
 * Nights that should be posted once the night audit for `businessDate` has run.
 * The audit closes out the night of `businessDate` itself, so the count is
 * inclusive of the business date (one more than `stayNightsThroughCheckout`,
 * which excludes the departure day). This is exactly the count a guest checking
 * out the morning after this audit would be billed, so the two paths reconcile
 * to the same number of charges with no gap and no double.
 */
export function stayNightsThroughAuditDate(
  arrivalDate: Date,
  businessDate: Date,
): number {
  return Math.max(1, differenceInCalendarDays(businessDate, arrivalDate) + 1);
}

/**
 * Builds the ordered snapshot suffix still owed for each canonical stay-charge
 * article. The shortfall decision remains count-based so reconciled unlinked
 * legacy lines remain the chronological prefix; every newly emitted line carries
 * the exact ReservationNight identity that follows that prefix.
 */
export function stayChargeShortfallLines({
  reservationId,
  reservationNo,
  arrangementType,
  arrivalDate,
  departureDate,
  expectedNights,
  reservationNights,
  lineItems,
  articles,
}: {
  reservationId: number;
  reservationNo: string;
  arrangementType: ArrangementType;
  arrivalDate: Date;
  departureDate: Date;
  expectedNights: number;
  reservationNights: StayChargeReservationNight[];
  lineItems: ExistingStayChargeLine[];
  articles: StayChargeArticle[];
}): PendingStayChargeLine[] {
  const eligibleNights = validatePostingSchedule({
    reservationId,
    reservationNo,
    arrivalDate,
    departureDate,
    expectedNights,
    reservationNights,
  });
  const postingArticles = requiredArticles({
    reservationNo,
    arrangementType,
    articles,
  });
  const lines: PendingStayChargeLine[] = [];

  for (const article of postingArticles) {
    const alreadyPosted = lineItems.filter(
      (lineItem) =>
        lineItem.articleId === article.id && lineItem.fbOrderId === null,
    ).length;
    const missingNights = eligibleNights.slice(alreadyPosted);
    const isRoomCharge = article.code === ROOM_CHARGE_ARTICLE_CODE;

    for (const missingNight of missingNights) {
      const unitPrice = isRoomCharge
        ? missingNight.rateAmount
        : new Prisma.Decimal(article.defaultPrice!);

      lines.push({
        reservationNightId: missingNight.id,
        serviceDate: missingNight.date,
        articleId: article.id,
        article,
        description: isRoomCharge ? "Room charge" : article.name,
        quantity: new Prisma.Decimal(1),
        unitPrice,
        amount: unitPrice,
      });
    }
  }

  return lines;
}

/**
 * Stay charges the night audit would have posted for the nights already stayed
 * but that are not yet on the folio. Used by the check-out screen to project the
 * true balance and by the check-out actions to post the shortfall before judging
 * the balance. Thin wrapper over {@link stayChargeShortfallLines} that supplies
 * the check-out night count.
 */
export function buildPendingStayChargeLines({
  reservationId,
  reservationNo,
  arrangementType,
  arrivalDate,
  departureDate,
  reservationNights,
  lineItems,
  articles,
  now = new Date(),
}: {
  reservationId: number;
  reservationNo: string;
  arrangementType: ArrangementType;
  arrivalDate: Date;
  departureDate: Date;
  reservationNights: StayChargeReservationNight[];
  lineItems: ExistingStayChargeLine[];
  articles: StayChargeArticle[];
  now?: Date;
}): PendingStayChargeLine[] {
  return stayChargeShortfallLines({
    reservationId,
    reservationNo,
    arrangementType,
    arrivalDate,
    departureDate,
    expectedNights: stayNightsThroughCheckout(arrivalDate, now),
    reservationNights,
    lineItems,
    articles,
  });
}

/**
 * Persist any stay charges (room charge + arrangement inclusions) the night
 * audit has not yet posted for the nights already stayed. Runs in a serializable
 * transaction and re-reads the folio's line items inside it so a concurrent
 * night audit cannot cause a double posting. Idempotent — posting nothing when
 * the folio is already current. Returns the number of line items created.
 */
export async function postPendingStayCharges({
  folioId,
  postedById,
  now = new Date(),
}: {
  folioId: number;
  postedById: number;
  now?: Date;
}): Promise<number> {
  for (let attempt = 1; attempt <= MAX_POSTING_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const folio = await tx.folio.findUnique({
            where: { id: folioId },
            select: {
              status: true,
              reservation: {
                select: {
                  id: true,
                  reservationNo: true,
                  status: true,
                  arrangementType: true,
                  arrivalDate: true,
                  departureDate: true,
                  reservationNights: {
                    select: {
                      id: true,
                      reservationId: true,
                      date: true,
                      rateAmount: true,
                    },
                    orderBy: { date: "asc" },
                  },
                },
              },
              lineItems: {
                select: {
                  articleId: true,
                  fbOrderId: true,
                  reservationNightId: true,
                },
              },
            },
          });

          if (!folio) {
            throw new StayChargePostingError("Folio tidak ditemukan.");
          }

          if (folio.status !== FolioStatus.OPEN) {
            throw new StayChargePostingError(
              "Stay charge tidak dapat diposting ke folio yang tidak OPEN.",
            );
          }

          if (folio.reservation.status !== ReservationStatus.CHECKED_IN) {
            throw new StayChargePostingError(
              "Stay charge hanya dapat diposting untuk reservasi CHECKED_IN.",
            );
          }

          const articles = await tx.article.findMany({
            where: { code: { in: [...STAY_CHARGE_ARTICLE_CODES] } },
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
              defaultPrice: true,
            },
          });
          const reservation = folio.reservation;
          const pending = buildPendingStayChargeLines({
            reservationId: reservation.id,
            reservationNo: reservation.reservationNo,
            arrangementType: reservation.arrangementType,
            arrivalDate: reservation.arrivalDate,
            departureDate: reservation.departureDate,
            reservationNights: reservation.reservationNights,
            lineItems: folio.lineItems,
            articles,
            now,
          });

          if (pending.length === 0) {
            return 0;
          }

          await tx.folioLineItem.createMany({
            data: pending.map((line) => ({
              folioId,
              articleId: line.articleId,
              fbOrderId: null,
              reservationNightId: line.reservationNightId,
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              amount: line.amount,
              postedById,
              postedAt: now,
            })),
          });

          return pending.length;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          ...TRANSACTION_OPTIONS,
        },
      );
    } catch (error) {
      if (error instanceof StayChargePostingError) {
        throw error;
      }

      if (isRetryablePostingConflict(error) && attempt < MAX_POSTING_ATTEMPTS) {
        continue;
      }

      if (isRetryablePostingConflict(error)) {
        throw new StayChargePostingError(
          "Konflik posting stay charge berulang. Muat ulang dan coba lagi.",
        );
      }

      throw error;
    }
  }

  throw new StayChargePostingError(
    "Konflik posting stay charge berulang. Muat ulang dan coba lagi.",
  );
}
