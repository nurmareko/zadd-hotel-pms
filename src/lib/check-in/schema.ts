import { GuestIdType, PaymentMethod } from "@prisma/client";
import { z } from "zod";

export const purposeOfVisitOptions = [
  "Bisnis",
  "Liburan",
  "Keluarga",
  "Acara",
  "Lainnya",
] as const;

// Values remain stable for stored reservations and submitted forms.
export const purposeOfVisitLabels: Record<PurposeOfVisitValue, string> = {
  Bisnis: "Business",
  Liburan: "Leisure",
  Keluarga: "Family",
  Acara: "Event",
  Lainnya: "Other",
};

export function purposeOfVisitLabel(value: string): string {
  return Object.prototype.hasOwnProperty.call(purposeOfVisitLabels, value)
    ? purposeOfVisitLabels[value as PurposeOfVisitValue]
    : value;
}

export const checkInDepositMethods = [
  PaymentMethod.CASH,
  PaymentMethod.TRANSFER,
  PaymentMethod.CARD,
] as const;

const TextOrEmptySchema = z
  .string()
  .trim()
  .max(100, "Text must be at most 100 characters")
  .optional()
  .transform((value) => value ?? "");

const OptionalGuestFieldSchema = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, `Text must be at most ${maxLength} characters`)
    .optional()
    .transform((value) => value ?? "");

const OptionalGuestEmailSchema = z
  .union([
    z
      .string()
      .trim()
      .email("Invalid email format")
      .max(100, "Email must be at most 100 characters"),
    z.literal(""),
  ])
  .optional()
  .transform((value) => value ?? "");

const BooleanConfirmationSchema = z.preprocess(
  (value) => value === true || value === "true" || value === "on",
  z.boolean().refine((value) => value, {
    message: "Guest arrival confirmation is required",
  }),
);

const SignatureDataUrlSchema = z
  .string()
  .min(1, "Guest signature is required")
  .max(2_000_000, "The signature is too large. Clear it and try again.")
  .regex(
    /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/,
    "Invalid signature format. Clear it and try again.",
  );

export const DepositCollectionSchema = z
  .object({
    reservationId: z.coerce
      .number("Select a reservation")
      .int("Invalid reservation")
      .positive("Select a reservation"),
    depositMethod: z.enum(checkInDepositMethods, {
      error: "Select a deposit payment method",
    }),
    depositReference: TextOrEmptySchema,
  })
  .superRefine((value, ctx) => {
    if (
      value.depositMethod === PaymentMethod.TRANSFER &&
      !value.depositReference
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["depositReference"],
        message: "A deposit reference is required for bank transfers",
      });
    }
  })
  .transform((value) => ({
    ...value,
    depositReference: value.depositReference || null,
  }));

export const CheckInSchema = z
  .object({
    reservationId: z.coerce
      .number("Select a reservation")
      .int("Invalid reservation")
      .positive("Select a reservation"),
    roomId: z.coerce
      .number("Select a room for check-in")
      .int("Invalid room")
      .positive("Select a room for check-in"),
    guestFullName: z
      .string()
      .trim()
      .min(1, "Guest name is required")
      .min(2, "Guest name must be at least 2 characters")
      .max(100, "Guest name must be at most 100 characters"),
    guestIdType: z
      .union([z.nativeEnum(GuestIdType), z.literal("")])
      .optional()
      .transform((value) => value || null),
    guestIdNumber: OptionalGuestFieldSchema(50),
    guestPhone: OptionalGuestFieldSchema(20),
    guestEmail: OptionalGuestEmailSchema,
    guestNationality: OptionalGuestFieldSchema(50),
    purposeOfVisit: z.enum(purposeOfVisitOptions, {
      error: "Select a purpose of visit",
    }),
    purposeOfVisitOther: TextOrEmptySchema,
    signatureDataUrl: SignatureDataUrlSchema,
    arrivalConfirmation: BooleanConfirmationSchema,
    depositMethod: z
      .union([
        z.enum(checkInDepositMethods, { error: "Select a deposit method" }),
        z.literal(""),
      ])
      .optional()
      .default(""),
    depositReference: TextOrEmptySchema,
  })
  .superRefine((value, ctx) => {
    if (value.purposeOfVisit === "Lainnya" && !value.purposeOfVisitOther) {
      ctx.addIssue({
        code: "custom",
        path: ["purposeOfVisitOther"],
        message: "Enter the purpose-of-visit details",
      });
    }

    if (
      value.depositMethod === PaymentMethod.TRANSFER &&
      !value.depositReference
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["depositReference"],
        message: "A deposit reference is required for bank transfers",
      });
    }
  })
  .transform((value) => ({
    ...value,
    grcPurposeOfVisit:
      value.purposeOfVisit === "Lainnya"
        ? value.purposeOfVisitOther
        : value.purposeOfVisit,
    depositMethod: value.depositMethod || null,
    depositReference: value.depositReference || null,
  }));

export type DepositCollectionValues = z.output<typeof DepositCollectionSchema>;
export type CheckInValues = z.output<typeof CheckInSchema>;
export type PurposeOfVisitValue = (typeof purposeOfVisitOptions)[number];
export type CheckInDepositMethod = (typeof checkInDepositMethods)[number];
