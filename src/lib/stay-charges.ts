import {
  type ArrangementType,
  Prisma,
  type Article,
  type FolioLineItem,
} from "@prisma/client";
import { differenceInCalendarDays } from "date-fns";

import { ARRANGEMENT_INCLUSION_ARTICLE_CODES } from "@/lib/arrangement-inclusions";
import { hotelTodayDateOnly } from "@/lib/date-only";
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

export type PendingStayChargeLine = {
  articleId: number;
  article: StayChargeArticle;
  description: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  amount: Prisma.Decimal;
};

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

function roomChargeAmount(rateAmount: Prisma.Decimal | null): Prisma.Decimal {
  const rate = new Prisma.Decimal(rateAmount ?? 0);

  return rate.lt(0) ? new Prisma.Decimal(0) : rate;
}

/**
 * The stay charges (room charge + arrangement inclusions) still owed for
 * `expectedNights` nights, given what is already posted. Idempotent and
 * order-independent: per article, only the shortfall between `expectedNights`
 * and the already-posted count is returned, so whichever path posts first (night
 * audit or check-out catch-up) the other posts only the remainder — a night can
 * never post twice. Posts nothing when the folio is already current (shortfall
 * ≤ 0). The single posting algorithm behind both the night audit and check-out.
 */
export function stayChargeShortfallLines({
  arrangementType,
  rateAmount,
  expectedNights,
  lineItems,
  articles,
}: {
  arrangementType: ArrangementType;
  rateAmount: Prisma.Decimal | null;
  expectedNights: number;
  lineItems: Pick<FolioLineItem, "articleId" | "fbOrderId">[];
  articles: StayChargeArticle[];
}): PendingStayChargeLine[] {
  const articleByCode = new Map(articles.map((article) => [article.code, article]));
  const inclusionArticleIds = new Set(
    ARRANGEMENT_INCLUSION_ARTICLE_CODES[arrangementType]
      .map((code) => articleByCode.get(code)?.id)
      .filter((articleId): articleId is number => articleId !== undefined),
  );

  const postedCountByArticleId = new Map<number, number>();
  for (const lineItem of lineItems) {
    if (lineItem.fbOrderId !== null && inclusionArticleIds.has(lineItem.articleId)) {
      continue;
    }

    postedCountByArticleId.set(
      lineItem.articleId,
      (postedCountByArticleId.get(lineItem.articleId) ?? 0) + 1,
    );
  }

  const codes = [
    ROOM_CHARGE_ARTICLE_CODE,
    ...ARRANGEMENT_INCLUSION_ARTICLE_CODES[arrangementType],
  ];

  const lines: PendingStayChargeLine[] = [];

  for (const code of codes) {
    const article = articleByCode.get(code);

    if (!article) {
      continue;
    }

    const isRoomCharge = code === ROOM_CHARGE_ARTICLE_CODE;
    const unitPrice = isRoomCharge
      ? roomChargeAmount(rateAmount)
      : article.defaultPrice === null
        ? null
        : new Prisma.Decimal(article.defaultPrice);

    // Inclusion article without a default price: skip, matching night audit.
    if (unitPrice === null) {
      continue;
    }

    const alreadyPosted = postedCountByArticleId.get(article.id) ?? 0;
    const missing = expectedNights - alreadyPosted;

    for (let i = 0; i < missing; i += 1) {
      lines.push({
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
  arrangementType,
  rateAmount,
  arrivalDate,
  lineItems,
  articles,
  now = new Date(),
}: {
  arrangementType: ArrangementType;
  rateAmount: Prisma.Decimal | null;
  arrivalDate: Date;
  lineItems: Pick<FolioLineItem, "articleId" | "fbOrderId">[];
  articles: StayChargeArticle[];
  now?: Date;
}): PendingStayChargeLine[] {
  return stayChargeShortfallLines({
    arrangementType,
    rateAmount,
    expectedNights: stayNightsThroughCheckout(arrivalDate, now),
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
  arrangementType,
  rateAmount,
  arrivalDate,
  articles,
  postedById,
  now = new Date(),
}: {
  folioId: number;
  arrangementType: ArrangementType;
  rateAmount: Prisma.Decimal | null;
  arrivalDate: Date;
  articles: StayChargeArticle[];
  postedById: number;
  now?: Date;
}): Promise<number> {
  return prisma.$transaction(
    async (tx) => {
      const lineItems = await tx.folioLineItem.findMany({
        where: { folioId },
        select: { articleId: true, fbOrderId: true },
      });

      const pending = buildPendingStayChargeLines({
        arrangementType,
        rateAmount,
        arrivalDate,
        lineItems,
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
}
