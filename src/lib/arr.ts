import { Prisma, ReservationNightRevenueClass } from "@prisma/client";

import {
  addDateOnlyDays,
  hotelTodayDateOnly,
  isValidISODateOnly,
  parseISODateOnly,
} from "@/lib/date-only";
import { prisma } from "@/lib/prisma";
import {
  hasLegacyNightlyRoomChargeShape,
  linkedRoomChargeIntegrityIssues,
} from "@/lib/room-charge-integrity";
import { ROOM_CHARGE_ARTICLE_CODE } from "@/lib/stay-charges";

export const ARR_CUTOVER_ENV = "ARR_CUTOVER_DATE";

export type ArrStatus =
  | "AUTHORITATIVE"
  | "UNAVAILABLE"
  | "NO_RECOGNIZED_NIGHTS"
  | "INTEGRITY_ERROR";

export type ArrResult = {
  status: ArrStatus;
  numerator: Prisma.Decimal;
  paidRoomNights: number;
  arr: Prisma.Decimal | null;
  fromInclusive: Date;
  toExclusive: Date;
  cutoverDate: Date;
  reason?: string;
};

export type ArrCutoverResult =
  | { ok: true; date: Date; source: "CONFIG" | "DERIVED" }
  | { ok: false; date: Date; reason: string };

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isDateOnlyBoundary(date: Date): boolean {
  return (
    !Number.isNaN(date.getTime()) &&
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  );
}

/** Converts inclusive user-entered ISO dates to one canonical half-open window. */
export function inclusiveArrRange(from: string, to: string): {
  fromInclusive: Date;
  toExclusive: Date;
} {
  const fromInclusive = parseISODateOnly(from);
  const inclusiveEnd = parseISODateOnly(to);

  if (inclusiveEnd < fromInclusive) {
    throw new RangeError("ARR range end must be on or after its start.");
  }

  return { fromInclusive, toExclusive: addDateOnlyDays(inclusiveEnd, 1) };
}

async function deriveCutover(): Promise<ArrCutoverResult> {
  const legacyFolios = await prisma.folio.findMany({
    where: {
      lineItems: {
        some: {
          article: { code: ROOM_CHARGE_ARTICLE_CODE },
          fbOrderId: null,
          reservationNightId: null,
        },
      },
    },
    select: {
      reservation: {
        select: {
          arrivalDate: true,
          departureDate: true,
          rateAmount: true,
          reservationNights: {
            select: { date: true },
            orderBy: { date: "asc" },
          },
        },
      },
      lineItems: {
        where: {
          article: { code: ROOM_CHARGE_ARTICLE_CODE },
          fbOrderId: null,
          reservationNightId: null,
        },
        select: {
          description: true,
          quantity: true,
          unitPrice: true,
          amount: true,
        },
        orderBy: [{ postedAt: "asc" }, { id: "asc" }],
      },
    },
  });

  let latestLegacyServiceDate: Date | null = null;
  const unclassifiableLegacyFolios: string[] = [];

  for (const folio of legacyFolios) {
    const reservation = folio.reservation;
    const expectedDates: Date[] = [];
    for (
      let cursor = reservation.arrivalDate;
      cursor < reservation.departureDate;
      cursor = addDateOnlyDays(cursor, 1)
    ) {
      expectedDates.push(cursor);
    }
    const scheduleIsComplete =
      reservation.reservationNights.length === expectedDates.length &&
      reservation.reservationNights.every(
        (night, index) => dateKey(night.date) === dateKey(expectedDates[index]),
      );
    const classifiableLines = folio.lineItems.filter((line) =>
      hasLegacyNightlyRoomChargeShape({
        ...line,
        reservationRateAmount: reservation.rateAmount,
      }),
    );

    if (
      !scheduleIsComplete ||
      classifiableLines.length !== folio.lineItems.length ||
      classifiableLines.length > expectedDates.length
    ) {
      unclassifiableLegacyFolios.push(
        `${dateKey(reservation.arrivalDate)} reservation prefix (schedule ${scheduleIsComplete ? "complete" : "invalid"}; ${folio.lineItems.length - classifiableLines.length} malformed line(s); ${classifiableLines.length}/${expectedDates.length} covered night(s))`,
      );
      continue;
    }

    const coveredNight = expectedDates[classifiableLines.length - 1];

    if (
      coveredNight &&
      (latestLegacyServiceDate === null || coveredNight > latestLegacyServiceDate)
    ) {
      latestLegacyServiceDate = coveredNight;
    }
  }

  if (unclassifiableLegacyFolios.length > 0) {
    return {
      ok: false,
      date: hotelTodayDateOnly(),
      reason: `Cannot derive ARR cutover from unclassifiable unlinked ROOM-CHARGE lines: ${unclassifiableLegacyFolios.join(", ")}. Configure ${ARR_CUTOVER_ENV} only after reconciling their service-night identity.`,
    };
  }

  if (latestLegacyServiceDate) {
    return {
      ok: true,
      date: addDateOnlyDays(latestLegacyServiceDate, 1),
      source: "DERIVED",
    };
  }

  const earliestLinked = await prisma.reservationNight.findFirst({
    where: {
      folioLineItems: {
        some: {
          article: { code: ROOM_CHARGE_ARTICLE_CODE },
          fbOrderId: null,
        },
      },
    },
    select: { date: true },
    orderBy: { date: "asc" },
  });

  return {
    ok: true,
    date: earliestLinked?.date ?? hotelTodayDateOnly(),
    source: "DERIVED",
  };
}

export async function getArrCutover(): Promise<ArrCutoverResult> {
  const configured = process.env[ARR_CUTOVER_ENV]?.trim();

  if (configured) {
    if (!isValidISODateOnly(configured)) {
      return {
        ok: false,
        date: hotelTodayDateOnly(),
        reason: `${ARR_CUTOVER_ENV} must be a valid YYYY-MM-DD date-only value.`,
      };
    }

    return { ok: true, date: parseISODateOnly(configured), source: "CONFIG" };
  }

  return deriveCutover();
}

/**
 * Computes weighted ARR from posted, linked PAID ROOM-CHARGE lines only.
 *
 * Rounding policy: division stays in Prisma Decimal; presentation rounds once to
 * whole IDR through the app's IDR formatter. OOO is excluded implicitly because
 * an unsold OOO room has no posted room-charge line. The historical mid-stay OOO
 * edge case (a charged night whose room was OOO on that service night) is not
 * handled: doing so requires per-service-night room-status identity. Current
 * Room.status must never be used because it is not historical.
 *
 * COMP is query-ready through ReservationNight.revenueClass and is excluded here,
 * but the operational COMP workflow remains outside this phase.
 */
export async function computeArr({
  fromInclusive,
  toExclusive,
  resolvedCutover,
}: {
  fromInclusive: Date;
  toExclusive: Date;
  resolvedCutover?: ArrCutoverResult;
}): Promise<ArrResult> {
  const zero = new Prisma.Decimal(0);
  const cutover = resolvedCutover ?? (await getArrCutover());
  const cutoverDate = cutover.date;
  const base = {
    numerator: zero,
    paidRoomNights: 0,
    arr: null,
    fromInclusive,
    toExclusive,
    cutoverDate,
  };

  if (!isDateOnlyBoundary(fromInclusive) || !isDateOnlyBoundary(toExclusive)) {
    return {
      ...base,
      status: "INTEGRITY_ERROR",
      reason: "ARR boundaries must be UTC-midnight date-only values.",
    };
  }
  if (toExclusive <= fromInclusive) {
    return {
      ...base,
      status: "INTEGRITY_ERROR",
      reason: "ARR range must be a non-empty half-open date range.",
    };
  }
  if (!cutover.ok) {
    return { ...base, status: "INTEGRITY_ERROR", reason: cutover.reason };
  }
  if (fromInclusive < cutoverDate) {
    return {
      ...base,
      status: "UNAVAILABLE",
      reason:
        toExclusive <= cutoverDate
          ? `Requested period is before ARR cutover ${dateKey(cutoverDate)}.`
          : `Requested period straddles ARR cutover ${dateKey(cutoverDate)}; the full range is unavailable and was not clamped.`,
    };
  }

  const lines = await prisma.folioLineItem.findMany({
    where: {
      article: { code: ROOM_CHARGE_ARTICLE_CODE },
      reservationNightId: { not: null },
      reservationNight: {
        date: { gte: fromInclusive, lt: toExclusive },
      },
    },
    select: {
      id: true,
      fbOrderId: true,
      reservationNightId: true,
      quantity: true,
      unitPrice: true,
      amount: true,
      folio: {
        select: {
          reservationId: true,
          reservation: { select: { arrivalDate: true, departureDate: true } },
        },
      },
      reservationNight: {
        select: {
          reservationId: true,
          date: true,
          rateAmount: true,
          revenueClass: true,
        },
      },
    },
    orderBy: { id: "asc" },
  });
  const asOfExclusive = addDateOnlyDays(hotelTodayDateOnly(), 1);
  const integrityIssues = lines.flatMap((line) => {
    const issues = linkedRoomChargeIntegrityIssues({
      id: line.id,
      fbOrderId: line.fbOrderId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      amount: line.amount,
      folioReservationId: line.folio.reservationId,
      reservationNightId: line.reservationNightId,
      reservationNightReservationId:
        line.reservationNight?.reservationId ?? null,
      reservationNightRateAmount: line.reservationNight?.rateAmount ?? null,
      serviceDate: line.reservationNight?.date ?? null,
      reservationArrivalDate: line.folio.reservation.arrivalDate,
      reservationDepartureDate: line.folio.reservation.departureDate,
    });

    if (line.reservationNight && line.reservationNight.date >= asOfExclusive) {
      issues.push(
        `line ${line.id}: service date ${dateKey(line.reservationNight.date)} is beyond as-of ${dateKey(addDateOnlyDays(asOfExclusive, -1))}`,
      );
    }

    return issues;
  });

  if (integrityIssues.length > 0) {
    return {
      ...base,
      status: "INTEGRITY_ERROR",
      reason: integrityIssues.join("; "),
    };
  }

  const paidLines = lines.filter(
    (line) =>
      line.fbOrderId === null &&
      line.reservationNight?.revenueClass ===
        ReservationNightRevenueClass.PAID,
  );
  const numerator = paidLines.reduce(
    (sum, line) => sum.plus(line.amount),
    zero,
  );
  const paidRoomNights = paidLines.length;

  if (paidRoomNights === 0) {
    return {
      ...base,
      status: "NO_RECOGNIZED_NIGHTS",
      reason: "No recognized paid room-charge nights exist in this period.",
    };
  }

  return {
    ...base,
    status: "AUTHORITATIVE",
    numerator,
    paidRoomNights,
    arr: numerator.dividedBy(paidRoomNights),
  };
}
