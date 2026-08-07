import {
  Prisma,
  FolioStatus,
  type Article,
  type FolioLineItem,
  type ReservationNight,
  ReservationStatus,
} from "@prisma/client";
import { addDays, differenceInCalendarDays } from "date-fns";

import {
  MEAL_ARTICLE_CODES,
  MEAL_PLAN_DEFINITIONS,
} from "@/lib/arrangement-inclusions";
import { dateOnlyBoundary, hotelTodayDateOnly } from "@/lib/date-only";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";

export const ROOM_CHARGE_ARTICLE_CODE = "ROOM-CHARGE";

/**
 * Article codes posted as nightly stay charges (room charge plus snapshotted
 * meal plans). This is the single source of truth shared by the night audit
 * and every check-out projection/catch-up path.
 */
export const STAY_CHARGE_ARTICLE_CODES = [
  ROOM_CHARGE_ARTICLE_CODE,
  ...MEAL_ARTICLE_CODES,
] as const;

export type StayChargeArticleCode = (typeof STAY_CHARGE_ARTICLE_CODES)[number];

export type StayChargeArticle = Pick<
  Article,
  "id" | "code" | "name" | "type" | "defaultPrice"
>;

export type StayChargeReservationNight = Pick<
  ReservationNight,
  | "id"
  | "reservationId"
  | "date"
  | "rateAmount"
  | "mealPlan"
  | "mealPax"
  | "mealUnitPrice"
  | "mealAmount"
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

export type StayChargePostingBlocker =
  | {
      kind: "INCOMPLETE_STAY_SCHEDULE";
      expectedCount: number;
      actualCount: number;
      affectedDate: Date;
    }
  | {
      kind: "OUT_OF_ORDER_STAY_SCHEDULE";
      position: number;
      expectedDate: Date | null;
      actualDate: Date;
    }
  | {
      kind: "NIGHT_OWNERSHIP_MISMATCH";
      nightId: string;
      affectedDate: Date;
      expectedReservationId: number;
      actualReservationId: number;
    }
  | {
      kind: "INVALID_ROOM_RATE";
      nightId: string;
      affectedDate: Date;
      rateAmount: string;
    }
  | {
      kind: "INCOMPLETE_MEAL_VALUES";
      nightId: string;
      affectedDate: Date;
    }
  | {
      kind: "INVALID_MEAL_VALUES";
      nightId: string;
      affectedDate: Date;
      mealPlan: string | null;
      mealPax: number | null;
      mealUnitPrice: string | null;
      mealAmount: string | null;
    }
  | {
      kind: "INVALID_EXPECTED_NIGHT_COUNT";
      expectedCount: number;
      affectedDate: Date;
    }
  | {
      kind: "STAY_SCHEDULE_SHORTFALL";
      expectedCount: number;
      actualCount: number;
      affectedDate: Date;
    }
  | {
      kind: "UNSUPPORTED_MEAL_PLAN";
      mealPlan: string;
      affectedDate: Date;
    }
  | {
      kind: "MISSING_STAY_CHARGE_ARTICLE";
      articleCode: string;
      affectedDate: Date | null;
    };

export class StayChargePostingError extends Error {
  constructor(
    message: string,
    public readonly blocker?: StayChargePostingBlocker,
  ) {
    super(message);
    this.name = "StayChargePostingError";
  }
}

const MAX_POSTING_ATTEMPTS = 3;

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function postingBlocked(
  reservationNo: string,
  detail: string,
  blocker?: StayChargePostingBlocker,
): never {
  throw new StayChargePostingError(
    `Posting stay charge ${reservationNo} diblokir: ${detail}`,
    blocker,
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
      {
        kind: "INCOMPLETE_STAY_SCHEDULE",
        expectedCount: expectedDates.length,
        actualCount: reservationNights.length,
        affectedDate:
          expectedDates.find(
            (expectedDate, index) =>
              !reservationNights[index] ||
              dateKey(reservationNights[index].date) !== dateKey(expectedDate),
          ) ??
          reservationNights[expectedDates.length]?.date ??
          departure,
      },
    );
  }

  for (const [index, night] of reservationNights.entries()) {
    const expectedDate = expectedDates[index];

    if (!expectedDate || dateKey(night.date) !== dateKey(expectedDate)) {
      postingBlocked(
        reservationNo,
        `jadwal ReservationNight harus berurutan dan kontigu; posisi ${index + 1} expected ${expectedDate ? dateKey(expectedDate) : "none"}, actual ${dateKey(night.date)}.`,
        {
          kind: "OUT_OF_ORDER_STAY_SCHEDULE",
          position: index + 1,
          expectedDate: expectedDate ?? null,
          actualDate: night.date,
        },
      );
    }

    if (night.reservationId !== reservationId) {
      postingBlocked(
        reservationNo,
        `snapshot ${night.id} bukan milik reservasi ini.`,
        {
          kind: "NIGHT_OWNERSHIP_MISMATCH",
          nightId: night.id,
          affectedDate: night.date,
          expectedReservationId: reservationId,
          actualReservationId: night.reservationId,
        },
      );
    }

    if (!night.rateAmount.isInteger() || night.rateAmount.isNegative()) {
      postingBlocked(
        reservationNo,
        `rate snapshot ${night.id} (${dateKey(night.date)}) harus whole-IDR dan tidak negatif.`,
        {
          kind: "INVALID_ROOM_RATE",
          nightId: night.id,
          affectedDate: night.date,
          rateAmount: night.rateAmount.toString(),
        },
      );
    }

    const mealValues = [
      night.mealPlan,
      night.mealPax,
      night.mealUnitPrice,
      night.mealAmount,
    ];
    const mealIsEmpty = mealValues.every((value) => value === null);
    const mealIsComplete = mealValues.every((value) => value !== null);

    if (!mealIsEmpty && !mealIsComplete) {
      postingBlocked(
        reservationNo,
        `meal snapshot ${night.id} (${dateKey(night.date)}) tidak lengkap.`,
        {
          kind: "INCOMPLETE_MEAL_VALUES",
          nightId: night.id,
          affectedDate: night.date,
        },
      );
    }

    if (mealIsComplete) {
      const definition = MEAL_PLAN_DEFINITIONS[night.mealPlan!];

      if (
        !definition ||
        !Number.isInteger(night.mealPax) ||
        night.mealPax! < 1 ||
        !night.mealUnitPrice!.isInteger() ||
        night.mealUnitPrice!.isNegative() ||
        !night.mealAmount!.isInteger() ||
        night.mealAmount!.isNegative() ||
        !night.mealAmount!.equals(night.mealUnitPrice!.mul(night.mealPax!))
      ) {
        postingBlocked(
          reservationNo,
          `meal snapshot ${night.id} (${dateKey(night.date)}) tidak valid.`,
          {
            kind: "INVALID_MEAL_VALUES",
            nightId: night.id,
            affectedDate: night.date,
            mealPlan: night.mealPlan,
            mealPax: night.mealPax,
            mealUnitPrice: night.mealUnitPrice?.toString() ?? null,
            mealAmount: night.mealAmount?.toString() ?? null,
          },
        );
      }
    }
  }

  if (!Number.isInteger(expectedNights) || expectedNights < 1) {
    postingBlocked(
      reservationNo,
      `expected nights tidak valid (${expectedNights}).`,
      {
        kind: "INVALID_EXPECTED_NIGHT_COUNT",
        expectedCount: expectedNights,
        affectedDate: dateOnlyBoundary(arrivalDate),
      },
    );
  }

  if (expectedNights > reservationNights.length) {
    postingBlocked(
      reservationNo,
      `membutuhkan ${expectedNights} malam tetapi hanya memiliki ${reservationNights.length} snapshot; perpanjang masa inap / buat snapshot terlebih dahulu.`,
      {
        kind: "STAY_SCHEDULE_SHORTFALL",
        expectedCount: expectedNights,
        actualCount: reservationNights.length,
        affectedDate: addDays(
          dateOnlyBoundary(arrivalDate),
          reservationNights.length,
        ),
      },
    );
  }

  return reservationNights.slice(0, expectedNights);
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
 * Builds stay-charge lines still owed. ROOM-CHARGE keeps its reconciled legacy
 * count-prefix behavior. Meals are driven only by each night's snapshot and use
 * exact ReservationNight + meal-article identity for idempotency.
 */
export function stayChargeShortfallLines({
  reservationId,
  reservationNo,
  arrivalDate,
  departureDate,
  expectedNights,
  reservationNights,
  lineItems,
  articles,
}: {
  reservationId: number;
  reservationNo: string;
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
  const articleByCode = new Map(articles.map((article) => [article.code, article]));
  const roomArticle = articleByCode.get(ROOM_CHARGE_ARTICLE_CODE);

  if (!roomArticle) {
    postingBlocked(
      reservationNo,
      `artikel ${ROOM_CHARGE_ARTICLE_CODE} tidak tersedia.`,
      {
        kind: "MISSING_STAY_CHARGE_ARTICLE",
        articleCode: ROOM_CHARGE_ARTICLE_CODE,
        affectedDate: eligibleNights[0]?.date ?? null,
      },
    );
  }

  const roomLines: PendingStayChargeLine[] = [];
  const postedRoomCount = lineItems.filter(
    (lineItem) =>
      lineItem.articleId === roomArticle.id && lineItem.fbOrderId === null,
  ).length;

  for (const night of eligibleNights.slice(postedRoomCount)) {
    roomLines.push({
      reservationNightId: night.id,
      serviceDate: night.date,
      articleId: roomArticle.id,
      article: roomArticle,
      description: "Room charge",
      quantity: new Prisma.Decimal(1),
      unitPrice: night.rateAmount,
      amount: night.rateAmount,
    });
  }

  const mealLines: PendingStayChargeLine[] = [];

  for (const night of eligibleNights) {
    if (night.mealPlan === null) {
      continue;
    }

    const definition = MEAL_PLAN_DEFINITIONS[night.mealPlan];

    if (!definition) {
      postingBlocked(
        reservationNo,
        `meal plan snapshot ${night.mealPlan} pada ${dateKey(night.date)} tidak dapat diposting.`,
        {
          kind: "UNSUPPORTED_MEAL_PLAN",
          mealPlan: night.mealPlan,
          affectedDate: night.date,
        },
      );
    }

    const article = articleByCode.get(definition.articleCode);

    if (!article) {
      postingBlocked(
        reservationNo,
        `artikel ${definition.articleCode} tidak tersedia.`,
        {
          kind: "MISSING_STAY_CHARGE_ARTICLE",
          articleCode: definition.articleCode,
          affectedDate: night.date,
        },
      );
    }

    const alreadyPosted = lineItems.some(
      (lineItem) =>
        lineItem.reservationNightId === night.id &&
        lineItem.articleId === article.id,
    );

    if (alreadyPosted) {
      continue;
    }

    mealLines.push({
      reservationNightId: night.id,
      serviceDate: night.date,
      articleId: article.id,
      article,
      description: article.name,
      quantity: new Prisma.Decimal(night.mealPax!),
      unitPrice: night.mealUnitPrice!,
      amount: night.mealAmount!,
    });
  }

  return [...roomLines, ...mealLines];
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
  arrivalDate,
  departureDate,
  reservationNights,
  lineItems,
  articles,
  now = new Date(),
}: {
  reservationId: number;
  reservationNo: string;
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
    arrivalDate,
    departureDate,
    expectedNights: stayNightsThroughCheckout(arrivalDate, now),
    reservationNights,
    lineItems,
    articles,
  });
}

/**
 * Persist any stay charges (room charge + snapshotted meals) the night
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
                  arrivalDate: true,
                  departureDate: true,
                  reservationNights: {
                    select: {
                      id: true,
                      reservationId: true,
                      date: true,
                      rateAmount: true,
                      mealPlan: true,
                      mealPax: true,
                      mealUnitPrice: true,
                      mealAmount: true,
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
