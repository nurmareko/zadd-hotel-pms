import {
  ArrangementType,
  ArticleType,
  FBOrderStatus,
  FolioStatus,
  Prisma,
  ReservationStatus,
  RoomBlockStatus,
  RoomStatus,
} from "@prisma/client";
import { addDays } from "date-fns";

import {
  hotelTodayDateOnly,
  hotelTodayISO,
  hotelTodayTimestampRange,
} from "@/lib/date-only";
import { formatCompactDateTimeID, formatLongDateID } from "@/lib/format";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";

import {
  ROOM_CHARGE_ARTICLE_CODE,
  stayChargeShortfallLines,
  StayChargePostingError,
  stayNightsThroughAuditDate,
  STAY_CHARGE_ARTICLE_CODES,
  type ExistingStayChargeLine,
  type StayChargeArticle,
  type StayChargeArticleCode,
  type StayChargePostingBlocker,
  type StayChargeReservationNight,
} from "@/lib/stay-charges";

// Re-exported under the night-audit name for the article codes/preview API.
const NIGHT_AUDIT_POSTING_ARTICLE_CODES = STAY_CHARGE_ARTICLE_CODES;
type NightAuditPostingArticleCode = StayChargeArticleCode;

const ZERO = new Prisma.Decimal(0);

type NightAuditReservation = {
  id: number;
  reservationNo: string;
  status: ReservationStatus;
  arrangementType: ArrangementType;
  arrivalDate: Date;
  departureDate: Date;
  reservationNights: StayChargeReservationNight[];
  guest: { fullName: string };
  room: { number: string } | null;
  folio: {
    id: number;
    folioNo: string;
    status: FolioStatus;
    lineItems: ExistingStayChargeLine[];
  } | null;
};

/**
 * The per-reservation data needed to recompute and post stay-charge shortfalls
 * inside the commit transaction (race-safe re-read), independent of the preview
 * line items the plan also builds.
 */
export type NightAuditStayChargeReservation = {
  reservationId: number;
  reservationNo: string;
  folioId: number;
  arrivalDate: Date;
  departureDate: Date;
  reservationNights: StayChargeReservationNight[];
};

export type NightAuditLineItemInput = {
  folioId: number;
  articleId: number;
  fbOrderId: null;
  reservationNightId: string;
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

export type NightAuditDomainRunSummary = {
  auditId: number;
  businessDate?: Date;
  businessDateLabel: string;
  roomRevenue: string;
  fbRevenue: string;
  otherRevenue: string;
  totalRevenue: string;
  warnings: string[];
  runAt?: Date;
  runAtLabel?: string;
  runByName?: string;
  roomsCharged?: number;
  lineItemsPosted?: number;
  transactionWriteCount?: number;
  chargedFolioIds?: number[];
  chargedReservationIds?: number[];
};

export type NightAuditRunSummary = NightAuditDomainRunSummary;

export type NightAuditRunResult =
  | { ok: true; summary: NightAuditRunSummary }
  | {
      ok: false;
      error: string;
      warnings?: string[];
      blockingErrors?: NightAuditBlocker[];
    };

export type NightAuditPostingArticlePreview = {
  code: NightAuditPostingArticleCode;
  name: string;
  amountSource: "room-rate-snapshot" | "meal-snapshot";
  amount: string | null;
};

export type NightAuditPreviewReservation = {
  id: number;
  reservationNo: string;
  guestName: string;
  roomNumber: string;
  folioNo: string;
  arrangementType: ArrangementType;
  lineItemCount: number;
  postingTotal: string;
};

export type NightAuditBlockerKind =
  | "MISSING_POSTING_ARTICLE"
  | "MISSING_FOLIO"
  | "FOLIO_NOT_OPEN"
  | "OPEN_FB_ORDER"
  | StayChargePostingBlocker["kind"];

export type NightAuditBlocker = {
  kind: NightAuditBlockerKind;
  reservation: {
    id: number;
    reservationNo: string;
    guestName: string;
    roomNumber: string | null;
    status: ReservationStatus;
    arrivalDate: Date;
    departureDate: Date;
  } | null;
  folio: {
    id: number;
    folioNo: string;
    status: FolioStatus;
  } | null;
  fbOrder?: {
    id: number;
    orderNo: string;
    status: FBOrderStatus;
  } | null;
  affectedDate: Date | null;
  isFutureDate: boolean;
  currentValues: Record<string, string | number | null>;
  explanation: string;
  resolution: string;
  message: string;
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
  postingLabel: string;
  postingArticles: NightAuditPostingArticlePreview[];
  reservations: NightAuditPreviewReservation[];
  warnings: string[];
  blockingErrors: NightAuditBlocker[];
  snapshot: NightAuditSnapshotInput;
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

export function classifyNightAuditRevenues({
  shortfallLineItems,
  existingDaytimeFolioLines,
  closedFbRevenueTotal,
  roomArticleId,
}: {
  shortfallLineItems: Array<{ articleId: number; amount: Prisma.Decimal }>;
  existingDaytimeFolioLines: Array<{
    amount: Prisma.Decimal;
    article: { code: string; type: ArticleType };
  }>;
  closedFbRevenueTotal: Prisma.Decimal | number | string | null | undefined;
  roomArticleId: number | undefined;
}) {
  const shortfallRoomRevenue = shortfallLineItems
    .filter((line) => line.articleId === roomArticleId)
    .reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));

  const shortfallInclusionRevenue = shortfallLineItems
    .filter((line) => line.articleId !== roomArticleId)
    .reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));

  const existingRoomRevenue = existingDaytimeFolioLines
    .filter(
      (line) =>
        line.article.code === ROOM_CHARGE_ARTICLE_CODE ||
        line.article.type === ArticleType.ROOM,
    )
    .reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));

  const existingInclusionRevenue = existingDaytimeFolioLines
    .filter(
      (line) =>
        line.article.code !== ROOM_CHARGE_ARTICLE_CODE &&
        line.article.type === ArticleType.FB,
    )
    .reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));

  const hkRevenue = existingDaytimeFolioLines
    .filter(
      (line) =>
        line.article.code !== ROOM_CHARGE_ARTICLE_CODE &&
        line.article.type === ArticleType.SERVICE,
    )
    .reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));
  const miscRevenue = existingDaytimeFolioLines
    .filter(
      (line) =>
        line.article.code !== ROOM_CHARGE_ARTICLE_CODE &&
        line.article.type !== ArticleType.ROOM &&
        line.article.type !== ArticleType.FB &&
        line.article.type !== ArticleType.SERVICE,
    )
    .reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));
  const otherRevenue = hkRevenue.plus(miscRevenue);

  const roomRevenue = shortfallRoomRevenue.plus(existingRoomRevenue);
  const inclusionRevenue = shortfallInclusionRevenue.plus(existingInclusionRevenue);
  const closedFbOrderRevenue = decimal(closedFbRevenueTotal);
  const fbRevenue = inclusionRevenue.plus(closedFbOrderRevenue);
  const totalRevenue = roomRevenue.plus(fbRevenue).plus(otherRevenue);

  return {
    roomRevenue,
    inclusionRevenue,
    closedFbOrderRevenue,
    fbRevenue,
    hkRevenue,
    miscRevenue,
    otherRevenue,
    totalRevenue,
  };
}

export function splitAuditedOtherRevenue(
  otherRevenue: Prisma.Decimal.Value,
  lines: Array<{
    amount: Prisma.Decimal.Value;
    article: { code: string; type: ArticleType };
  }>,
): { hkRevenue: Prisma.Decimal; miscRevenue: Prisma.Decimal } {
  const storedOtherRevenue = new Prisma.Decimal(otherRevenue);
  const classified = classifyNightAuditRevenues({
    shortfallLineItems: [],
    existingDaytimeFolioLines: lines.map((line) => ({
      ...line,
      amount: new Prisma.Decimal(line.amount),
    })),
    closedFbRevenueTotal: null,
    roomArticleId: undefined,
  });

  // Article metadata can change after an audit. Never replace its stored total
  // or invent a departmental allocation when the available lines do not reconcile.
  if (storedOtherRevenue.isZero() || !classified.otherRevenue.equals(storedOtherRevenue)) {
    return { hkRevenue: new Prisma.Decimal(0), miscRevenue: storedOtherRevenue };
  }
  return { hkRevenue: classified.hkRevenue, miscRevenue: classified.miscRevenue };
}

function addDecimal(
  values: Array<Prisma.Decimal | number | string | null | undefined>,
): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>(
    (sum, value) => sum.plus(decimal(value)),
    new Prisma.Decimal(0),
  );
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

function futureDateContext(affectedDate: Date | null, businessDate: Date) {
  return affectedDate !== null && affectedDate.getTime() > businessDate.getTime();
}

function blockerMessage({
  reservation,
  fbOrder,
  affectedDate,
  explanation,
  resolution,
}: Pick<
  NightAuditBlocker,
  "reservation" | "fbOrder" | "affectedDate" | "explanation" | "resolution"
>) {
  const heading = reservation
    ? `Reservation ${reservation.reservationNo} — ${reservation.guestName}, Room ${reservation.roomNumber ?? "not assigned"}`
    : fbOrder
      ? `F&B order ${fbOrder.orderNo}`
    : "Night Audit Configuration";
  const dateLine = affectedDate
    ? `Affected date: ${businessDateLabel(affectedDate)}.`
    : null;

  return [heading, dateLine, explanation, resolution].filter(Boolean).join("\n");
}

function reservationContext(reservation: NightAuditReservation) {
  return {
    id: reservation.id,
    reservationNo: reservation.reservationNo,
    guestName: reservation.guest.fullName,
    roomNumber: reservation.room?.number ?? null,
    status: reservation.status,
    arrivalDate: reservation.arrivalDate,
    departureDate: reservation.departureDate,
  };
}

function createBlocker(
  blocker: Omit<NightAuditBlocker, "message">,
): NightAuditBlocker {
  return { ...blocker, message: blockerMessage(blocker) };
}

function validatePostingArticles(
  articles: Awaited<ReturnType<typeof prisma.article.findMany>>,
  businessDate: Date,
) {
  const articleByCode = new Map(articles.map((article) => [article.code, article]));
  const blockingErrors: NightAuditBlocker[] = [];

  for (const code of NIGHT_AUDIT_POSTING_ARTICLE_CODES) {
    if (!articleByCode.has(code)) {
      const explanation = `Night Audit cannot post charges because article ${code} is unavailable. Without this article, revenue could be recorded under the wrong charge type or not recorded at all.`;
      const resolution = `Ask an administrator to add and activate article ${code}, then reload Night Audit.`;
      blockingErrors.push(
        createBlocker({
          kind: "MISSING_POSTING_ARTICLE",
          reservation: null,
          folio: null,
          fbOrder: null,
          affectedDate: businessDate,
          isFutureDate: false,
          currentValues: { articleCode: code },
          explanation,
          resolution,
        }),
      );
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
        code === ROOM_CHARGE_ARTICLE_CODE
          ? "room-rate-snapshot"
          : "meal-snapshot",
      amount: null,
    };
  });
}

function validateReservations(
  reservations: NightAuditReservation[],
  businessDate: Date,
) {
  const blockingErrors: NightAuditBlocker[] = [];
  const warnings: string[] = [];

  for (const reservation of reservations) {
    const context = reservationContext(reservation);

    if (!reservation.folio) {
      const explanation = `Night Audit cannot post charges for ${businessDateLabel(businessDate)} because this reservation has no folio. Continuing without a folio risks omitting stay charges from the guest bill.`;
      const resolution = "Create a folio for this reservation, then reload Night Audit.";
      blockingErrors.push(
        createBlocker({
          kind: "MISSING_FOLIO",
          reservation: context,
          folio: null,
          fbOrder: null,
          affectedDate: businessDate,
          isFutureDate: false,
          currentValues: { folioStatus: null },
          explanation,
          resolution,
        }),
      );
      continue;
    }

    if (reservation.folio.status !== FolioStatus.OPEN) {
      const explanation = `Night Audit cannot post charges for ${businessDateLabel(businessDate)} to folio ${reservation.folio.folioNo} because its status is ${reservation.folio.status}. Posting to a folio that is not OPEN risks changing a bill that is closed or no longer active.`;
      const resolution = `Review folio ${reservation.folio.folioNo}. Reopen it if it was closed in error, or resolve the reservation still in ${reservation.status} status, then reload Night Audit.`;
      blockingErrors.push(
        createBlocker({
          kind: "FOLIO_NOT_OPEN",
          reservation: context,
          folio: {
            id: reservation.folio.id,
            folioNo: reservation.folio.folioNo,
            status: reservation.folio.status,
          },
          fbOrder: null,
          affectedDate: businessDate,
          isFutureDate: false,
          currentValues: {
            folioStatus: reservation.folio.status,
            requiredFolioStatus: FolioStatus.OPEN,
          },
          explanation,
          resolution,
        }),
      );
    }

  }

  return { blockingErrors, warnings };
}

type OpenFbOrder = {
  id: number;
  orderNo: string;
  status: FBOrderStatus;
  chargedFolio: {
    id: number;
    folioNo: string;
    status: FolioStatus;
    reservation: {
      id: number;
      reservationNo: string;
      status: ReservationStatus;
      arrivalDate: Date;
      departureDate: Date;
      guest: { fullName: string };
      room: { number: string } | null;
    };
  } | null;
};

function validateOpenFbOrders(orders: OpenFbOrder[], businessDate: Date) {
  return orders.map((order) => {
    const reservation = order.chargedFolio?.reservation;
    const context = reservation
      ? {
          id: reservation.id,
          reservationNo: reservation.reservationNo,
          guestName: reservation.guest.fullName,
          roomNumber: reservation.room?.number ?? null,
          status: reservation.status,
          arrivalDate: reservation.arrivalDate,
          departureDate: reservation.departureDate,
        }
      : null;
    const folio = order.chargedFolio
      ? {
          id: order.chargedFolio.id,
          folioNo: order.chargedFolio.folioNo,
          status: order.chargedFolio.status,
        }
      : null;
    const explanation = reservation
      ? `F&B order ${order.orderNo} is still OPEN and cannot yet be counted as a completed F&B transaction for Night Audit.`
      : `F&B order ${order.orderNo} is still OPEN, so the transaction is not complete for Night Audit.`;
    const resolution = `Open F&B order ${order.orderNo}, confirm the bill, then complete payment or Charge to Room as appropriate.`;

    return createBlocker({
      kind: "OPEN_FB_ORDER",
      reservation: context,
      folio,
      fbOrder: { id: order.id, orderNo: order.orderNo, status: order.status },
      affectedDate: businessDate,
      isFutureDate: false,
      currentValues: { orderId: order.id, orderStatus: order.status },
      explanation,
      resolution,
    });
  });
}

/**
 * Stay-charge line items the night audit should post for one reservation on
 * `businessDate`, computed as the shortfall against what is already on the folio
 * (room charge + snapshotted meals). Shared by the plan/preview (fed the
 * line items read up front) and the commit transaction (fed the line items
 * re-read inside the txn), so both are idempotent and identical in logic. A
 * normal nightly run yields exactly one night per article; a night the check-out
 * catch-up already posted yields zero.
 */
export function buildAuditStayChargeLines({
  reservation,
  existingLineItems,
  articles,
  businessDate,
  postedById,
  postedAt,
  label,
}: {
  reservation: NightAuditStayChargeReservation;
  existingLineItems: ExistingStayChargeLine[];
  articles: StayChargeArticle[];
  businessDate: Date;
  postedById: number;
  postedAt: Date;
  label: string;
}): NightAuditLineItemInput[] {
  const roomArticleId = articles.find(
    (article) => article.code === ROOM_CHARGE_ARTICLE_CODE,
  )?.id;

  const shortfall = stayChargeShortfallLines({
    reservationId: reservation.reservationId,
    reservationNo: reservation.reservationNo,
    arrivalDate: reservation.arrivalDate,
    departureDate: reservation.departureDate,
    expectedNights: stayNightsThroughAuditDate(
      reservation.arrivalDate,
      businessDate,
      reservation.departureDate,
    ),
    reservationNights: reservation.reservationNights,
    lineItems: existingLineItems,
    articles,
  });

  return shortfall.map((line) => ({
    folioId: reservation.folioId,
    articleId: line.articleId,
    fbOrderId: null,
    reservationNightId: line.reservationNightId,
    description:
      line.articleId === roomArticleId
        ? `Night Audit Room Charge - ${label}`
        : `Night Audit ${line.article.name} Inclusion - ${label}`,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    amount: line.amount,
    postedById,
    postedAt,
  }));
}

function blockerFromStayChargeError({
  error,
  reservation,
  businessDate,
}: {
  error: StayChargePostingError;
  reservation: NightAuditReservation;
  businessDate: Date;
}): NightAuditBlocker {
  const reason = error.blocker;
  const context = reservationContext(reservation);
  const folio = reservation.folio
    ? {
        id: reservation.folio.id,
        folioNo: reservation.folio.folioNo,
        status: reservation.folio.status,
      }
    : null;

  if (!reason) {
    const explanation = `Night Audit cannot prepare charges for this reservation. Continuing risks incomplete or inaccurate stay charges.`;
    const resolution = "Review the rate schedule and inclusions for this reservation and correct any invalid data, then reload Night Audit.";
    return createBlocker({
      kind: "INCOMPLETE_STAY_SCHEDULE",
      reservation: context,
      folio,
      affectedDate: businessDate,
      isFutureDate: false,
      currentValues: {},
      explanation,
      resolution,
    });
  }

  const affectedDate =
    reason.kind === "OUT_OF_ORDER_STAY_SCHEDULE"
      ? reason.expectedDate ?? reason.actualDate
      : reason.affectedDate;
  const isFutureDate = futureDateContext(affectedDate, businessDate);
  const futureExplanation = isFutureDate
    ? ` The date ${businessDateLabel(affectedDate!)} is after the business date ${businessDateLabel(businessDate)}. Night Audit checks the entire stay schedule, so this future date must be corrected before closing the business date.`
    : "";
  let explanation: string;
  let resolution: string;
  let currentValues: Record<string, string | number | null>;

  switch (reason.kind) {
    case "INCOMPLETE_STAY_SCHEDULE":
      explanation = `The reservation rate schedule is incomplete: the stay requires ${reason.expectedCount} nights, but rates are available for only ${reason.actualCount} nights. Night Audit stopped to avoid missing nights or charging incorrect rates.${futureExplanation}`;
      resolution = "Enter rates for every night from arrival up to but not including departure, then reload Night Audit.";
      currentValues = {
        requiredNightCount: reason.expectedCount,
        availableNightCount: reason.actualCount,
      };
      break;
    case "OUT_OF_ORDER_STAY_SCHEDULE":
      explanation = `Rate schedule position ${reason.position} records ${businessDateLabel(reason.actualDate)}, but should be ${reason.expectedDate ? businessDateLabel(reason.expectedDate) : "no additional date"}. Night Audit stopped to avoid posting charges to the wrong night.${futureExplanation}`;
      resolution = "Correct the rate dates so they are consecutive with no missing or duplicate dates, then reload Night Audit.";
      currentValues = {
        position: reason.position,
        requiredDate: reason.expectedDate?.toISOString().slice(0, 10) ?? null,
        recordedDate: reason.actualDate.toISOString().slice(0, 10),
      };
      break;
    case "NIGHT_OWNERSHIP_MISMATCH":
      explanation = `The rate for ${businessDateLabel(reason.affectedDate)} belongs to another reservation. Night Audit stopped to avoid posting this guest's charges to the wrong reservation or folio.${futureExplanation}`;
      resolution = "Link the nightly rate to the correct reservation, then reload Night Audit.";
      currentValues = {
        nightId: reason.nightId,
        requiredReservationId: reason.expectedReservationId,
        recordedReservationId: reason.actualReservationId,
      };
      break;
    case "INVALID_ROOM_RATE":
      explanation = `The room rate for ${businessDateLabel(reason.affectedDate)} is ${reason.rateAmount}. It must be a nonnegative whole-IDR amount to ensure correct room revenue.${futureExplanation}`;
      resolution = "Correct the nightly room rate to a nonnegative whole-IDR amount, then reload Night Audit.";
      currentValues = { nightId: reason.nightId, rateAmount: reason.rateAmount };
      break;
    case "INVALID_STAY_CHARGE_AMOUNT":
      explanation = `The Arrangement allocation for ${businessDateLabel(reason.affectedDate)} of ${reason.mealAmount} exceeds the package rate of ${reason.rateAmount}, making the room amount negative. Night Audit stopped to avoid recording negative room revenue.${futureExplanation}`;
      resolution = "Correct the nightly package rate or Arrangement allocation so the room amount is not negative, then reload Night Audit.";
      currentValues = {
        nightId: reason.nightId,
        rateAmount: reason.rateAmount,
        mealAmount: reason.mealAmount,
      };
      break;
    case "INCOMPLETE_MEAL_VALUES":
      explanation = `Meal inclusion data for ${businessDateLabel(reason.affectedDate)} is incomplete. Night Audit stopped to avoid missing, excessive, or incorrectly priced inclusion charges.${futureExplanation}`;
      resolution = "Complete the meal plan, guest count, price per guest, and total; or remove all inclusion data if the night has no meal plan. Then reload Night Audit.";
      currentValues = { nightId: reason.nightId };
      break;
    case "INVALID_MEAL_VALUES":
      explanation = `Meal inclusion data for ${businessDateLabel(reason.affectedDate)} is invalid. Guest count must be at least one, IDR amounts must be whole and nonnegative, and the total must equal the price per guest multiplied by the guest count.${futureExplanation}`;
      resolution = "Correct the nightly inclusion plan and amounts, then reload Night Audit.";
      currentValues = {
        nightId: reason.nightId,
        mealPlan: reason.mealPlan,
        mealPax: reason.mealPax,
        mealUnitPrice: reason.mealUnitPrice,
        mealAmount: reason.mealAmount,
      };
      break;
    case "INVALID_EXPECTED_NIGHT_COUNT":
      explanation = `The number of nights to post is ${reason.expectedCount}, so Night Audit cannot determine the correct charges. Continuing risks undercharging or overcharging the stay.${futureExplanation}`;
      resolution = "Check the reservation arrival date and business date and correct any invalid dates, then reload Night Audit.";
      currentValues = { requiredNightCount: reason.expectedCount };
      break;
    case "STAY_SCHEDULE_SHORTFALL":
      explanation = `Night Audit cannot post charges for the night of ${businessDateLabel(reason.affectedDate)}. The reservation is still ${reservation.status}, but the scheduled stay ends on ${businessDateLabel(reservation.departureDate)} and there is no rate for that night. Forcing the process to continue could leave the guest bill incomplete.${futureExplanation}`;
      resolution = "If the guest has departed, complete check-out. If the guest is still staying, extend the departure date, then reload Night Audit.";
      currentValues = {
        requiredNightCount: reason.expectedCount,
        availableNightCount: reason.actualCount,
      };
      break;
    case "UNSUPPORTED_MEAL_PLAN":
      explanation = `Meal plan ${reason.mealPlan} for ${businessDateLabel(reason.affectedDate)} cannot be posted. Night Audit stopped to avoid assigning F&B revenue to the wrong plan.${futureExplanation}`;
      resolution = "Select an available meal plan for that night or remove the inclusion if not applicable, then reload Night Audit.";
      currentValues = { mealPlan: reason.mealPlan };
      break;
    case "MISSING_STAY_CHARGE_ARTICLE":
      explanation = `Night Audit cannot post charges because article ${reason.articleCode} is unavailable. Without this article, revenue could be recorded under the wrong charge type or not recorded at all.${futureExplanation}`;
      resolution = `Ask an administrator to add and activate article ${reason.articleCode}, then reload Night Audit.`;
      currentValues = { articleCode: reason.articleCode };
      break;
  }

  return createBlocker({
    kind: reason.kind,
    reservation: context,
    folio,
    affectedDate,
    isFutureDate,
    currentValues,
    explanation,
    resolution,
  });
}

function buildLineItems({
  reservations,
  articles,
  businessDate,
  postedById,
  postedAt,
  label,
}: {
  reservations: NightAuditReservation[];
  articles: StayChargeArticle[];
  businessDate: Date;
  postedById: number;
  postedAt: Date;
  label: string;
}) {
  const lineItems: NightAuditLineItemInput[] = [];
  const previews: NightAuditPreviewReservation[] = [];
  const blockingErrors: NightAuditBlocker[] = [];

  for (const reservation of reservations) {
    if (!reservation.folio || reservation.folio.status !== FolioStatus.OPEN) {
      continue;
    }

    const folio = reservation.folio;
    let reservationLineItems: NightAuditLineItemInput[];

    try {
      reservationLineItems = buildAuditStayChargeLines({
        reservation: {
          reservationId: reservation.id,
          reservationNo: reservation.reservationNo,
          folioId: folio.id,
          arrivalDate: reservation.arrivalDate,
          departureDate: reservation.departureDate,
          reservationNights: reservation.reservationNights,
        },
        existingLineItems: folio.lineItems,
        articles,
        businessDate,
        postedById,
        postedAt,
        label,
      });
    } catch (error) {
      if (error instanceof StayChargePostingError) {
        blockingErrors.push(
          blockerFromStayChargeError({ error, reservation, businessDate }),
        );
        continue;
      }

      throw error;
    }

    // Folio already current for this business date (e.g. check-out catch-up
    // posted the night first): nothing to post, omit from the preview.
    if (reservationLineItems.length === 0) {
      continue;
    }

    lineItems.push(...reservationLineItems);
    previews.push({
      id: reservation.id,
      reservationNo: reservation.reservationNo,
      guestName: reservation.guest.fullName,
      roomNumber: reservation.room?.number ?? "-",
      folioNo: folio.folioNo,
      arrangementType: reservation.arrangementType,
      lineItemCount: reservationLineItems.length,
      postingTotal: addDecimal(
        reservationLineItems.map((lineItem) => lineItem.amount),
      ).toString(),
    });
  }

  return { lineItems, previews, blockingErrors };
}

export async function buildNightAuditPlan({
  runById,
  now = new Date(),
}: {
  runById: number;
  now?: Date;
}): Promise<NightAuditPlan> {
  const businessDate = hotelTodayDateOnly(now);
  const nextBusinessDate = addDays(businessDate, 1);
  // Snapshot windows and audit business date both follow the live WIB calendar
  // day, independent of the server clock timezone.
  const { start: timestampStart, end: timestampEnd } =
    hotelTodayTimestampRange(now);
  const postingLabel = hotelTodayISO(now);

  const [
    existingAudit,
    reservations,
    articles,
    openFbOrders,
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
            mealPlan: true,
            mealPax: true,
            mealUnitPrice: true,
            mealAmount: true,
          },
          orderBy: { date: "asc" },
        },
        guest: { select: { fullName: true } },
        room: { select: { number: true } },
        folio: {
          select: {
            id: true,
            folioNo: true,
            status: true,
            lineItems: {
              select: {
                articleId: true,
                fbOrderId: true,
                reservationNightId: true,
              },
            },
          },
        },
      },
    }),
    prisma.article.findMany({
      where: { code: { in: [...NIGHT_AUDIT_POSTING_ARTICLE_CODES] } },
      orderBy: { code: "asc" },
    }),
    prisma.fBOrder.findMany({
      where: { status: FBOrderStatus.OPEN },
      orderBy: { orderNo: "asc" },
      select: {
        id: true,
        orderNo: true,
        status: true,
        chargedFolio: {
          select: {
            id: true,
            folioNo: true,
            status: true,
            reservation: {
              select: {
                id: true,
                reservationNo: true,
                status: true,
                arrivalDate: true,
                departureDate: true,
                guest: { select: { fullName: true } },
                room: { select: { number: true } },
              },
            },
          },
        },
      },
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
    prisma.folioLineItem.findMany({
      where: {
        postedAt: { gte: timestampStart, lt: timestampEnd },
        fbOrderId: null,
      },
      select: {
        amount: true,
        article: { select: { code: true, type: true } },
      },
    }),
  ]);

  const { articleByCode, blockingErrors: articleErrors } =
    validatePostingArticles(articles, businessDate);
  const { blockingErrors: reservationErrors, warnings: reservationWarnings } =
    validateReservations(reservations, businessDate);
  const fbOrderErrors = validateOpenFbOrders(openFbOrders, businessDate);
  const {
    lineItems,
    previews,
    blockingErrors: schedulePostingErrors,
  } = buildLineItems({
    reservations,
    articles,
    businessDate,
    postedById: runById,
    postedAt: now,
    label: postingLabel,
  });

  const roomArticleId = articleByCode.get(ROOM_CHARGE_ARTICLE_CODE)?.id;
  const {
    roomRevenue,
    inclusionRevenue: fbInclusionRevenue,
    closedFbOrderRevenue,
    fbRevenue,
    otherRevenue,
    totalRevenue,
  } = classifyNightAuditRevenues({
    shortfallLineItems: lineItems,
    existingDaytimeFolioLines: otherFolioRevenue,
    closedFbRevenueTotal: closedFbRevenue._sum.total,
    roomArticleId,
  });
  const computedOccupancyRate = occupancyRate(roomsOccupied, totalRooms);
  const arrangementBreakdown: Record<ArrangementType, number> = {
    [ArrangementType.RO]: 0,
    [ArrangementType.BB]: 0,
    [ArrangementType.HB]: 0,
    [ArrangementType.FB]: 0,
  };

  for (const reservation of reservations) {
    arrangementBreakdown[reservation.arrangementType] += 1;
  }

  const warnings = [...reservationWarnings];

  if (openFbOrders.length > 0) {
    warnings.push(
      `${openFbOrders.length} F&B orders are still open and must be completed before Night Audit.`,
    );
  }



  const roomLineCount = lineItems.filter(
    (lineItem) => lineItem.articleId === roomArticleId,
  ).length;



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
    openFbOrderCount: openFbOrders.length,
    arrangementBreakdown,
    inHouseCount: reservations.length,
    lineItemCount: lineItems.length,
    roomChargeCount: previews.length,
    inclusionCount: lineItems.length - roomLineCount,
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
    postingLabel,
    postingArticles: buildPostingArticlesPreview(articleByCode),
    reservations: previews,
    warnings,
    blockingErrors: [
      ...articleErrors,
      ...reservationErrors,
      ...fbOrderErrors,
      ...schedulePostingErrors,
    ],
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
  };
}

export class NightAuditClosedError extends Error {
  constructor(public readonly businessDate: Date) {
    super(`Night Audit for ${businessDateLabel(businessDate)} is already complete.`);
    this.name = "NightAuditClosedError";
  }
}

export async function assertBusinessDateOpen(
  tx: Prisma.TransactionClient,
  now: Date = new Date(),
): Promise<void> {
  const businessDate = hotelTodayDateOnly(now);
  const existingAudit = await tx.nightAudit.findUnique({
    where: { businessDate },
    select: { id: true },
  });

  if (existingAudit) {
    throw new NightAuditClosedError(businessDate);
  }
}

class NightAuditAlreadyCompletedError extends Error {
  constructor(public readonly businessDate: Date) {
    super(`Night Audit for ${businessDateLabel(businessDate)} is already complete.`);
    this.name = "NightAuditAlreadyCompletedError";
  }
}

class NightAuditBlockerError extends Error {
  constructor(
    public readonly blockers: NightAuditBlocker[],
    public readonly warnings: string[] = [],
  ) {
    super(blockers.map((b) => b.message).join("\n\n"));
    this.name = "NightAuditBlockerError";
  }
}

export const MAX_AUDIT_ATTEMPTS = 3;

function uniqueBusinessDateError(error: unknown) {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.some(
      (t) =>
        typeof t === "string" &&
        (t.includes("business_date") || t.includes("businessDate")),
    );
  }
  if (typeof target === "string") {
    return target.includes("business_date") || target.includes("businessDate");
  }
  return false;
}

function retryableAuditPostingConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" ||
      (error.code === "P2002" && !uniqueBusinessDateError(error)))
  );
}

export async function executeNightAudit({
  runById,
  now = new Date(),
}: {
  runById: number;
  now?: Date;
}): Promise<NightAuditRunResult> {
  const businessDate = hotelTodayDateOnly(now);
  const nextBusinessDate = addDays(businessDate, 1);
  const { start: timestampStart, end: timestampEnd } =
    hotelTodayTimestampRange(now);
  const postingLabel = hotelTodayISO(now);

  for (let attempt = 1; attempt <= MAX_AUDIT_ATTEMPTS; attempt += 1) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          // 1. Fail-fast check for existing audit on businessDate
          const existingAudit = await tx.nightAudit.findUnique({
            where: { businessDate },
            select: { id: true },
          });

          if (existingAudit) {
            throw new NightAuditAlreadyCompletedError(businessDate);
          }

          // 2. Authoritatively load articles (STAY_CHARGE_ARTICLE_CODES) and validate
          const articles = await tx.article.findMany({
            where: { code: { in: [...STAY_CHARGE_ARTICLE_CODES] } },
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
              defaultPrice: true,
            },
            orderBy: { code: "asc" },
          });

          const { articleByCode, blockingErrors: articleErrors } =
            validatePostingArticles(articles, businessDate);

          if (articleErrors.length > 0) {
            throw new NightAuditBlockerError(articleErrors);
          }

          // 3. Authoritatively load checked-in reservations and folios
          const reservations = await tx.reservation.findMany({
            where: { status: ReservationStatus.CHECKED_IN },
            orderBy: { reservationNo: "asc" },
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
                  mealPlan: true,
                  mealPax: true,
                  mealUnitPrice: true,
                  mealAmount: true,
                },
                orderBy: { date: "asc" },
              },
              guest: { select: { fullName: true } },
              room: { select: { number: true } },
              folio: {
                select: {
                  id: true,
                  folioNo: true,
                  status: true,
                  lineItems: {
                    select: {
                      articleId: true,
                      fbOrderId: true,
                      reservationNightId: true,
                    },
                  },
                },
              },
            },
          });
          const openFbOrders = await tx.fBOrder.findMany({
            where: { status: FBOrderStatus.OPEN },
            orderBy: { orderNo: "asc" },
            select: {
              id: true,
              orderNo: true,
              status: true,
              chargedFolio: {
                select: {
                  id: true,
                  folioNo: true,
                  status: true,
                  reservation: {
                    select: {
                      id: true,
                      reservationNo: true,
                      status: true,
                      arrivalDate: true,
                      departureDate: true,
                      guest: { select: { fullName: true } },
                      room: { select: { number: true } },
                    },
                  },
                },
              },
            },
          });

          // Validate reservations and their folios (must be OPEN)
          const {
            blockingErrors: reservationErrors,
            warnings: reservationWarnings,
          } = validateReservations(reservations, businessDate);

          const fbOrderErrors = validateOpenFbOrders(openFbOrders, businessDate);

          if (reservationErrors.length > 0 || fbOrderErrors.length > 0) {
            throw new NightAuditBlockerError(
              [...reservationErrors, ...fbOrderErrors],
              reservationWarnings,
            );
          }

          // 4. Run counts & aggregates in tx (using Promise.all)
          // MUST execute before lineItemsToCreate are inserted so stay charges are not double counted in otherRevenue
          const [
            totalRooms,
            roomsOccupied,
            checkInCount,
            checkOutCount,
            closedFbRevenue,
            otherFolioRevenue,
            openFbOrderRows,
          ] = await Promise.all([
            tx.room.count(),
            tx.room.count({
              where: { status: { in: [RoomStatus.OC, RoomStatus.OD] } },
            }),
            tx.reservation.count({
              where: {
                arrivalDate: { gte: businessDate, lt: nextBusinessDate },
                status: {
                  notIn: [
                    ReservationStatus.CANCELLED,
                    ReservationStatus.NO_SHOW,
                  ],
                },
              },
            }),
            tx.reservation.count({
              where: {
                departureDate: { gte: businessDate, lt: nextBusinessDate },
                status: {
                  notIn: [
                    ReservationStatus.CANCELLED,
                    ReservationStatus.NO_SHOW,
                  ],
                },
              },
            }),
            tx.fBOrder.aggregate({
              where: {
                status: FBOrderStatus.CLOSED,
                closedAt: { gte: timestampStart, lt: timestampEnd },
              },
              _sum: { total: true },
            }),
            tx.folioLineItem.findMany({
              where: {
                postedAt: { gte: timestampStart, lt: timestampEnd },
                fbOrderId: null,
              },
              select: {
                amount: true,
                article: { select: { code: true, type: true } },
              },
            }),
            Promise.resolve(openFbOrders),
          ]);

          // 5. Build shortfall lines using buildAuditStayChargeLines
          const lineItemsToCreate: NightAuditLineItemInput[] = [];
          const chargedFolioIds = new Set<number>();
          const chargedReservationIds = new Set<number>();
          const stayScheduleErrors: NightAuditBlocker[] = [];

          for (const reservation of reservations) {
            if (
              !reservation.folio ||
              reservation.folio.status !== FolioStatus.OPEN
            ) {
              continue;
            }

            try {
              const lines = buildAuditStayChargeLines({
                reservation: {
                  reservationId: reservation.id,
                  reservationNo: reservation.reservationNo,
                  folioId: reservation.folio.id,
                  arrivalDate: reservation.arrivalDate,
                  departureDate: reservation.departureDate,
                  reservationNights: reservation.reservationNights,
                },
                existingLineItems: reservation.folio.lineItems,
                articles,
                businessDate,
                postedById: runById,
                postedAt: now,
                label: postingLabel,
              });

              if (lines.length > 0) {
                chargedFolioIds.add(reservation.folio.id);
                chargedReservationIds.add(reservation.id);
                lineItemsToCreate.push(...lines);
              }
            } catch (error) {
              if (error instanceof StayChargePostingError) {
                stayScheduleErrors.push(
                  blockerFromStayChargeError({
                    error,
                    reservation,
                    businessDate,
                  }),
                );
                continue;
              }
              throw error;
            }
          }

          if (stayScheduleErrors.length > 0) {
            throw new NightAuditBlockerError(
              stayScheduleErrors,
              reservationWarnings,
            );
          }

          let transactionWriteCount = 0;
          const roomBlockWarnings: string[] = [];

          // Keep closing-day metrics above unchanged. Lock rooms before folio writes,
          // matching the room-first order used by check-in/checkout and block writers.
          const coveringBlockWhere = {
            status: RoomBlockStatus.ACTIVE,
            startDate: { lte: nextBusinessDate },
            endDate: { gt: nextBusinessDate },
          };
          const roomCandidates = await tx.room.findMany({
            where: {
              OR: [
                { status: RoomStatus.OOO },
                { roomBlocks: { some: coveringBlockWhere } },
              ],
            },
            select: { id: true },
            orderBy: { id: "asc" },
          });

          for (const candidate of roomCandidates) {
            await tx.$queryRaw`SELECT id FROM "room" WHERE id = ${candidate.id} FOR UPDATE`;
            const room = await tx.room.findUnique({
              where: { id: candidate.id },
              select: { id: true, number: true, status: true },
            });
            if (!room) continue;

            const block = await tx.roomBlock.findFirst({
              where: { roomId: room.id, ...coveringBlockWhere },
              select: { id: true },
              orderBy: { id: "asc" },
            });
            const newStatus = block
              ? RoomStatus.OOO
              : room.status === RoomStatus.OOO ? RoomStatus.VD : null;
            if (!newStatus || newStatus === room.status) continue;

            // Dates do not end physical occupancy; unfinished cleaning can span days.
            const occupant = await tx.reservation.findFirst({
              where: { roomId: room.id, status: ReservationStatus.CHECKED_IN },
              select: { id: true },
            });
            const cleaningSession = await tx.cleaningSession.findFirst({
              where: { roomId: room.id, startedAt: { not: null }, finishedAt: null },
              select: { id: true },
            });
            if (occupant || cleaningSession) {
              roomBlockWarnings.push(
                `Room ${room.number} status was not changed at business-day rollover: ${occupant ? "the guest has not checked out" : "cleaning is still in progress"}. Review the room status after the process completes.`,
              );
              continue;
            }

            const updated = await tx.room.updateMany({
              where: { id: room.id, status: room.status },
              data: { status: newStatus },
            });
            if (updated.count !== 1) {
              throw new Prisma.PrismaClientKnownRequestError(
                "Room status changed while Night Audit was running.",
                { code: "P2034", clientVersion: Prisma.prismaVersion.client },
              );
            }
            await tx.housekeepingLog.create({
              data: {
                roomId: room.id,
                oldStatus: room.status,
                newStatus,
                updatedById: runById,
                updatedAt: now,
                note: block
                  ? `Room block #${block.id} active at business-day rollover.`
                  : "The room block has ended. The room was set to VD for cleaning.",
              },
            });
            transactionWriteCount += 2;
          }

          // 6. Insert shortfall lines with tx.folioLineItem.createMany
          if (lineItemsToCreate.length > 0) {
            await tx.folioLineItem.createMany({ data: lineItemsToCreate });
            transactionWriteCount += 1;
          }

          // 7. Calculate roomRevenue, inclusionRevenue, fbRevenue, totalRevenue, and occupancyRate
          const roomArticleId = articleByCode.get(ROOM_CHARGE_ARTICLE_CODE)?.id;

          const { roomRevenue, fbRevenue, hkRevenue, miscRevenue, otherRevenue, totalRevenue } =
            classifyNightAuditRevenues({
              shortfallLineItems: lineItemsToCreate,
              existingDaytimeFolioLines: otherFolioRevenue,
              closedFbRevenueTotal: closedFbRevenue._sum.total,
              roomArticleId,
            });

          const computedOccupancyRate = occupancyRate(
            roomsOccupied,
            totalRooms,
          );

          // 8. Insert immutable audit row
          const audit = await tx.nightAudit.create({
            data: {
              businessDate,
              runById,
              totalRooms,
              roomsOccupied,
              occupancyRate: computedOccupancyRate,
              roomRevenue,
              fbRevenue,
              hkRevenue,
              miscRevenue,
              otherRevenue,
              totalRevenue,
              checkInCount,
              checkOutCount,
              inHouseCount: reservations.length,
            },
            select: {
              id: true,
              runAt: true,
              runBy: { select: { fullName: true } },
            },
          });
          transactionWriteCount += 1;

          const warnings = [...reservationWarnings, ...roomBlockWarnings];
          if (openFbOrderRows.length > 0) {
            warnings.push(
              `${openFbOrderRows.length} F&B orders are still open and must be completed before Night Audit.`,
            );
          }

          return {
            auditId: audit.id,
            businessDate,
            businessDateLabel: businessDateLabel(businessDate),
            runAt: audit.runAt,
            runAtLabel: formatCompactDateTimeID(audit.runAt),
            runByName: audit.runBy.fullName,
            roomsCharged: chargedFolioIds.size,
            lineItemsPosted: lineItemsToCreate.length,
            transactionWriteCount,
            chargedFolioIds: [...chargedFolioIds],
            chargedReservationIds: [...chargedReservationIds],
            roomRevenue: roomRevenue.toString(),
            fbRevenue: fbRevenue.toString(),
            otherRevenue: otherRevenue.toString(),
            totalRevenue: totalRevenue.toString(),
            warnings,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          ...TRANSACTION_OPTIONS,
        },
      );

      return {
        ok: true,
        summary: result,
      };
    } catch (error) {
      if (error instanceof NightAuditAlreadyCompletedError) {
        return {
          ok: false,
          error: error.message,
        };
      }

      if (uniqueBusinessDateError(error)) {
        return {
          ok: false,
          error: `Night Audit for ${businessDateLabel(businessDate)} was already run by another session.`,
        };
      }

      if (error instanceof NightAuditBlockerError) {
        return {
          ok: false,
          error: error.blockers.map((b) => b.message).join("\n\n"),
          warnings: error.warnings,
          blockingErrors: error.blockers,
        };
      }

      if (error instanceof StayChargePostingError) {
        return {
          ok: false,
          error:
            "Reservation data changed while Night Audit was running. No charges were posted. Reload the page, review the updated list, and try again.",
        };
      }

      if (retryableAuditPostingConflict(error) && attempt < MAX_AUDIT_ATTEMPTS) {
        continue;
      }

      if (retryableAuditPostingConflict(error)) {
        return {
          ok: false,
          error: "Repeated Night Audit posting conflicts. Reload and try again.",
        };
      }

      throw error;
    }
  }

  return {
    ok: false,
    error: "Repeated Night Audit posting conflicts. Reload and try again.",
  };
}
