import {
  PricingRuleAdjustmentKind,
  PricingRuleDayOfWeek,
  PricingRuleSelectorKind,
} from "@prisma/client";
import { z } from "zod";

import { isValidISODateOnly, parseISODateOnly } from "@/lib/date-only";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().nullable().optional(),
);

const booleanInput = z.preprocess(
  (value) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  },
  z.boolean(),
);

const signedDecimal = /^-?\d{1,10}(?:\.\d{1,2})?$/;

export const pricingRuleSelectorKinds = [
  PricingRuleSelectorKind.DAY_OF_WEEK,
  PricingRuleSelectorKind.DATE_RANGE,
] as const;

export const pricingRuleDays = [
  PricingRuleDayOfWeek.MONDAY,
  PricingRuleDayOfWeek.TUESDAY,
  PricingRuleDayOfWeek.WEDNESDAY,
  PricingRuleDayOfWeek.THURSDAY,
  PricingRuleDayOfWeek.FRIDAY,
  PricingRuleDayOfWeek.SATURDAY,
  PricingRuleDayOfWeek.SUNDAY,
] as const;

export const pricingRuleAdjustmentKinds = [
  PricingRuleAdjustmentKind.AMOUNT_DELTA,
  PricingRuleAdjustmentKind.PERCENT_DELTA,
] as const;

const PricingRuleBaseSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Season name is required")
      .max(255, "Season name must not exceed 255 characters"),
    roomTypeId: z.coerce.number().int().positive("Select a room type"),
    selectorKind: z.enum(pricingRuleSelectorKinds, {
      error: "Select a validity period type",
    }),
    dayOfWeek: optionalText.pipe(
      z.enum(pricingRuleDays, { error: "Select a valid day" }).nullable().optional(),
    ),
    startsOn: optionalText.pipe(
      z
        .string()
        .refine(isValidISODateOnly, "Invalid start date")
        .nullable()
        .optional(),
    ),
    endsBefore: optionalText.pipe(
      z
        .string()
        .refine(isValidISODateOnly, "Invalid end date")
        .nullable()
        .optional(),
    ),
    adjustmentKind: z.enum(pricingRuleAdjustmentKinds, {
      error: "Select an adjustment type",
    }),
    adjustmentValue: z
      .string()
      .trim()
      .regex(
        signedDecimal,
        "Adjustment must be a signed number with at most 2 decimal places",
      ),
    isActive: booleanInput,
  })
  .superRefine((value, context) => {
    const hasDay = Boolean(value.dayOfWeek);
    const hasStart = Boolean(value.startsOn);
    const hasEnd = Boolean(value.endsBefore);

    if (value.selectorKind === PricingRuleSelectorKind.DAY_OF_WEEK) {
      if (!hasDay || hasStart || hasEnd) {
        context.addIssue({
          code: "custom",
          path: ["dayOfWeek"],
          message:
            "A weekday season must have one weekday and no date range",
        });
      }
      return;
    }

    if (hasDay || !hasStart || !hasEnd) {
      context.addIssue({
        code: "custom",
        path: ["startsOn"],
        message:
          "A date-range season must have a start and end date and no weekday",
      });
      return;
    }

    if (
      !isValidISODateOnly(value.startsOn!) ||
      !isValidISODateOnly(value.endsBefore!)
    ) {
      return;
    }

    if (
      parseISODateOnly(value.startsOn!).getTime() >=
      parseISODateOnly(value.endsBefore!).getTime()
    ) {
      context.addIssue({
        code: "custom",
        path: ["endsBefore"],
        message: "End date must be after the start date",
      });
    }
  });

export const PricingRuleCreateSchema = PricingRuleBaseSchema;
export const PricingRuleUpdateSchema = PricingRuleBaseSchema.and(
  z.object({ id: z.string().cuid("Invalid season") }),
);
export const PricingRuleIdSchema = z.object({
  id: z.string().cuid("Invalid season"),
});
export const PricingRuleToggleSchema = PricingRuleIdSchema.extend({
  isActive: booleanInput,
});

export const PricingPreviewSchema = z
  .object({
    roomTypeId: z.coerce.number().int().positive("Select a room type"),
    arrivalDate: z
      .string()
      .refine(isValidISODateOnly, "Invalid arrival date"),
    departureDate: z
      .string()
      .refine(isValidISODateOnly, "Invalid departure date"),
  })
  .superRefine((value, context) => {
    if (
      !isValidISODateOnly(value.arrivalDate) ||
      !isValidISODateOnly(value.departureDate)
    ) {
      return;
    }

    const arrival = parseISODateOnly(value.arrivalDate);
    const departure = parseISODateOnly(value.departureDate);

    if (arrival >= departure) {
      context.addIssue({
        code: "custom",
        path: ["departureDate"],
        message: "Departure date must be after the arrival date",
      });
      return;
    }

    const nights = (departure.getTime() - arrival.getTime()) / 86_400_000;

    if (nights > 366) {
      context.addIssue({
        code: "custom",
        path: ["departureDate"],
        message: "Preview is limited to 366 nights",
      });
    }
  });
