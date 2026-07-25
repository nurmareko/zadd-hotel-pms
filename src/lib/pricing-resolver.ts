import {
  Prisma,
  PricingRuleAdjustmentKind,
  PricingRuleDayOfWeek,
  PricingRuleSelectorKind,
  type PricingRule,
} from "@prisma/client";

import { parseISODateOnly } from "@/lib/date-only";
import { prisma } from "@/lib/prisma";

const dayOfWeekByUtcDay = [
  PricingRuleDayOfWeek.SUNDAY,
  PricingRuleDayOfWeek.MONDAY,
  PricingRuleDayOfWeek.TUESDAY,
  PricingRuleDayOfWeek.WEDNESDAY,
  PricingRuleDayOfWeek.THURSDAY,
  PricingRuleDayOfWeek.FRIDAY,
  PricingRuleDayOfWeek.SATURDAY,
] as const;

type PricingRuleForResolution = Pick<
  PricingRule,
  | "id"
  | "name"
  | "selectorKind"
  | "dayOfWeek"
  | "startsOn"
  | "endsBefore"
  | "adjustmentKind"
  | "adjustmentValue"
>;

type RoomTypePricingSet = {
  id: number;
  baseRate: Prisma.Decimal;
  pricingRules: PricingRuleForResolution[];
};

export type ResolvedNightlyRate = {
  date: Date;
  rate: Prisma.Decimal;
  baseRate: Prisma.Decimal;
  sourceRule: {
    id: string;
    name: string;
    selectorKind: PricingRuleSelectorKind;
  } | null;
};

export class PricingResolutionError extends Error {}

function addUtcDateOnlyDay(date: Date): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function roundWholeIDR(amount: Prisma.Decimal): Prisma.Decimal {
  // Equivalent to the folio settlement policy's Math.round for allowed
  // non-negative rates, while preserving Decimal precision.
  return amount.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
}

export function applyPricingRuleAdjustment(
  baseRate: Prisma.Decimal,
  adjustmentKind: PricingRuleAdjustmentKind,
  adjustmentValue: Prisma.Decimal,
): Prisma.Decimal {
  const adjusted =
    adjustmentKind === PricingRuleAdjustmentKind.AMOUNT_DELTA
      ? baseRate.plus(adjustmentValue)
      : baseRate.plus(baseRate.mul(adjustmentValue).div(100));

  return roundWholeIDR(adjusted);
}

function validatePricingSet(pricingSet: RoomTypePricingSet) {
  for (const rule of pricingSet.pricingRules) {
    const validWeekdayShape =
      rule.selectorKind === PricingRuleSelectorKind.DAY_OF_WEEK &&
      rule.dayOfWeek !== null &&
      rule.startsOn === null &&
      rule.endsBefore === null;
    const validRangeShape =
      rule.selectorKind === PricingRuleSelectorKind.DATE_RANGE &&
      rule.dayOfWeek === null &&
      rule.startsOn !== null &&
      rule.endsBefore !== null &&
      rule.startsOn < rule.endsBefore;

    if (!validWeekdayShape && !validRangeShape) {
      throw new PricingResolutionError(
        `Aturan harga aktif “${rule.name}” memiliki selector yang tidak valid.`,
      );
    }
  }
}

function resolveFromPricingSet(
  pricingSet: RoomTypePricingSet,
  date: Date,
): ResolvedNightlyRate {
  const matchingRanges = pricingSet.pricingRules.filter(
    (rule) =>
      rule.selectorKind === PricingRuleSelectorKind.DATE_RANGE &&
      rule.startsOn !== null &&
      rule.endsBefore !== null &&
      rule.startsOn <= date &&
      date < rule.endsBefore,
  );

  if (matchingRanges.length > 1) {
    throw new PricingResolutionError(
      "Terdapat rentang tanggal aktif yang tumpang tindih untuk tipe kamar ini.",
    );
  }

  const weekday = dayOfWeekByUtcDay[date.getUTCDay()];
  const matchingWeekdays = pricingSet.pricingRules.filter(
    (rule) =>
      rule.selectorKind === PricingRuleSelectorKind.DAY_OF_WEEK &&
      rule.dayOfWeek === weekday,
  );

  if (matchingWeekdays.length > 1) {
    throw new PricingResolutionError(
      "Terdapat lebih dari satu aturan hari aktif untuk tipe kamar ini.",
    );
  }

  const rule = matchingRanges[0] ?? matchingWeekdays[0] ?? null;
  const rate = rule
    ? applyPricingRuleAdjustment(
        pricingSet.baseRate,
        rule.adjustmentKind,
        rule.adjustmentValue,
      )
    : roundWholeIDR(pricingSet.baseRate);

  if (!rate.isPositive()) {
    throw new PricingResolutionError(
      "Aturan harga harus menghasilkan tarif malam lebih besar dari 0.",
    );
  }

  return {
    date,
    rate,
    baseRate: roundWholeIDR(pricingSet.baseRate),
    sourceRule: rule
      ? {
          id: rule.id,
          name: rule.name,
          selectorKind: rule.selectorKind,
        }
      : null,
  };
}

type PricingResolverClient = Pick<Prisma.TransactionClient, "roomType">;

async function loadPricingSet(
  roomTypeId: number,
  client: PricingResolverClient = prisma,
): Promise<RoomTypePricingSet> {
  const roomType = await client.roomType.findUnique({
    where: { id: roomTypeId },
    select: {
      id: true,
      baseRate: true,
      pricingRules: {
        where: { isActive: true },
        orderBy: { id: "asc" },
        select: {
          id: true,
          name: true,
          selectorKind: true,
          dayOfWeek: true,
          startsOn: true,
          endsBefore: true,
          adjustmentKind: true,
          adjustmentValue: true,
        },
      },
    },
  });

  if (!roomType) {
    throw new PricingResolutionError("Tipe kamar tidak ditemukan.");
  }

  validatePricingSet(roomType);
  return roomType;
}

export async function resolveNightlyRate(
  roomTypeId: number,
  date: string,
): Promise<ResolvedNightlyRate> {
  const pricingSet = await loadPricingSet(roomTypeId);
  return resolveFromPricingSet(pricingSet, parseISODateOnly(date));
}

export async function resolveNightlySchedule(
  {
    roomTypeId,
    arrivalDate,
    departureDate,
  }: {
    roomTypeId: number;
    arrivalDate: string;
    departureDate: string;
  },
  client: PricingResolverClient = prisma,
): Promise<ResolvedNightlyRate[]> {
  const arrival = parseISODateOnly(arrivalDate);
  const departure = parseISODateOnly(departureDate);

  if (arrival >= departure) {
    throw new PricingResolutionError(
      "Tanggal keberangkatan harus setelah tanggal kedatangan.",
    );
  }

  const pricingSet = await loadPricingSet(roomTypeId, client);
  const schedule: ResolvedNightlyRate[] = [];

  for (let date = arrival; date < departure; date = addUtcDateOnlyDay(date)) {
    schedule.push(resolveFromPricingSet(pricingSet, date));
  }

  return schedule;
}
