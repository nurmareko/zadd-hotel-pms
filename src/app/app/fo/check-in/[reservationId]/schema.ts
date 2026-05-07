import { PaymentMethod } from "@prisma/client";
import { z } from "zod";

export const purposeOfVisitOptions = [
  "Bisnis",
  "Liburan",
  "Keluarga",
  "Acara",
  "Lainnya",
] as const;

export const checkInDepositMethods = [
  PaymentMethod.CASH,
  PaymentMethod.TRANSFER,
  PaymentMethod.CARD,
] as const;

const TextOrEmptySchema = z
  .string()
  .trim()
  .max(100, "Text must be 100 characters or fewer")
  .optional()
  .transform((value) => value ?? "");

const BooleanConfirmationSchema = z.preprocess(
  (value) => value === true || value === "true" || value === "on",
  z.boolean().refine((value) => value, {
    message: "Guest arrival confirmation is required",
  }),
);

const MoneySchema = z.preprocess(
  (value) => (value === "" || value == null ? 0 : value),
  z.coerce.number("Deposit amount is required").min(0, "Deposit cannot be negative"),
);

export const CheckInSchema = z
  .object({
    reservationId: z.coerce
      .number("Reservation is required")
      .int("Reservation is invalid")
      .positive("Reservation is required"),
    roomId: z.coerce
      .number("Room is required")
      .int("Room is invalid")
      .positive("Room is required"),
    purposeOfVisit: z.enum(purposeOfVisitOptions),
    purposeOfVisitOther: TextOrEmptySchema,
    arrivalConfirmation: BooleanConfirmationSchema,
    depositAmount: MoneySchema,
    depositMethod: z
      .union([z.enum(checkInDepositMethods), z.literal("")])
      .optional()
      .default(""),
    depositReference: TextOrEmptySchema,
  })
  .superRefine((value, ctx) => {
    if (value.purposeOfVisit === "Lainnya" && !value.purposeOfVisitOther) {
      ctx.addIssue({
        code: "custom",
        message: "Custom purpose of visit is required when choosing Lainnya",
      });
    }

    if (value.depositAmount > 0 && !value.depositMethod) {
      ctx.addIssue({
        code: "custom",
        message: "Deposit method is required when deposit amount is greater than 0",
      });
    }

    if (
      value.depositAmount > 0 &&
      value.depositMethod === PaymentMethod.TRANSFER &&
      !value.depositReference
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Deposit reference is required for transfer payments",
      });
    }
  })
  .transform((value) => ({
    ...value,
    grcPurposeOfVisit:
      value.purposeOfVisit === "Lainnya"
        ? value.purposeOfVisitOther
        : value.purposeOfVisit,
    depositMethod: value.depositAmount > 0 ? value.depositMethod : null,
    depositReference: value.depositReference || null,
  }));

export type CheckInInput = z.input<typeof CheckInSchema>;
export type CheckInValues = z.output<typeof CheckInSchema>;
export type PurposeOfVisitValue = (typeof purposeOfVisitOptions)[number];
export type CheckInDepositMethod = (typeof checkInDepositMethods)[number];
