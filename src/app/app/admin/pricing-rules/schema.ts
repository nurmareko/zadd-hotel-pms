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
      .min(1, "Nama aturan wajib diisi")
      .max(255, "Nama aturan maksimal 255 karakter"),
    roomTypeId: z.coerce.number().int().positive("Pilih tipe kamar"),
    selectorKind: z.enum(pricingRuleSelectorKinds, {
      error: "Pilih jenis selector",
    }),
    dayOfWeek: optionalText.pipe(
      z.enum(pricingRuleDays, { error: "Pilih hari yang valid" }).nullable().optional(),
    ),
    startsOn: optionalText.pipe(
      z
        .string()
        .refine(isValidISODateOnly, "Tanggal mulai tidak valid")
        .nullable()
        .optional(),
    ),
    endsBefore: optionalText.pipe(
      z
        .string()
        .refine(isValidISODateOnly, "Batas akhir tidak valid")
        .nullable()
        .optional(),
    ),
    adjustmentKind: z.enum(pricingRuleAdjustmentKinds, {
      error: "Pilih jenis penyesuaian",
    }),
    adjustmentValue: z
      .string()
      .trim()
      .regex(
        signedDecimal,
        "Nilai penyesuaian harus angka bertanda dengan maksimal 2 desimal",
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
            "Aturan hari harus memiliki satu hari tanpa rentang tanggal",
        });
      }
      return;
    }

    if (hasDay || !hasStart || !hasEnd) {
      context.addIssue({
        code: "custom",
        path: ["startsOn"],
        message:
          "Aturan rentang harus memiliki tanggal mulai dan batas akhir tanpa hari",
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
        message: "Batas akhir harus setelah tanggal mulai",
      });
    }
  });

export const PricingRuleCreateSchema = PricingRuleBaseSchema;
export const PricingRuleUpdateSchema = PricingRuleBaseSchema.and(
  z.object({ id: z.string().cuid("Aturan harga tidak valid") }),
);
export const PricingRuleIdSchema = z.object({
  id: z.string().cuid("Aturan harga tidak valid"),
});
export const PricingRuleToggleSchema = PricingRuleIdSchema.extend({
  isActive: booleanInput,
});

export const PricingPreviewSchema = z
  .object({
    roomTypeId: z.coerce.number().int().positive("Pilih tipe kamar"),
    arrivalDate: z
      .string()
      .refine(isValidISODateOnly, "Tanggal kedatangan tidak valid"),
    departureDate: z
      .string()
      .refine(isValidISODateOnly, "Tanggal keberangkatan tidak valid"),
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
        message: "Tanggal keberangkatan harus setelah tanggal kedatangan",
      });
      return;
    }

    const nights = (departure.getTime() - arrival.getTime()) / 86_400_000;

    if (nights > 366) {
      context.addIssue({
        code: "custom",
        path: ["departureDate"],
        message: "Pratinjau dibatasi maksimal 366 malam",
      });
    }
  });
