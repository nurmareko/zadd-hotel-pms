import { GuestIdType, PaymentMethod } from "@prisma/client";
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
  .max(100, "Teks maksimal 100 karakter")
  .optional()
  .transform((value) => value ?? "");

const OptionalGuestFieldSchema = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, `Teks maksimal ${maxLength} karakter`)
    .optional()
    .transform((value) => value ?? "");

const OptionalGuestEmailSchema = z
  .union([
    z
      .string()
      .trim()
      .email("Format email tidak valid")
      .max(100, "Email maksimal 100 karakter"),
    z.literal(""),
  ])
  .optional()
  .transform((value) => value ?? "");

const BooleanConfirmationSchema = z.preprocess(
  (value) => value === true || value === "true" || value === "on",
  z.boolean().refine((value) => value, {
    message: "Konfirmasi kedatangan tamu wajib dicentang",
  }),
);

const SignatureDataUrlSchema = z
  .string()
  .min(1, "Tanda tangan tamu wajib diisi")
  .max(2_000_000, "Ukuran tanda tangan terlalu besar. Hapus lalu coba lagi.")
  .regex(
    /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/,
    "Format tanda tangan tidak valid. Hapus lalu coba lagi.",
  );

export const DepositCollectionSchema = z
  .object({
    reservationId: z.coerce
      .number("Reservasi wajib dipilih")
      .int("Reservasi tidak valid")
      .positive("Reservasi wajib dipilih"),
    depositMethod: z.enum(checkInDepositMethods, {
      error: "Pilih metode pembayaran deposit",
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
        message: "Referensi deposit wajib diisi untuk transfer",
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
      .number("Reservasi wajib dipilih")
      .int("Reservasi tidak valid")
      .positive("Reservasi wajib dipilih"),
    roomId: z.coerce
      .number("Pilih kamar untuk check-in")
      .int("Kamar tidak valid")
      .positive("Pilih kamar untuk check-in"),
    guestFullName: z
      .string()
      .trim()
      .min(1, "Nama tamu wajib diisi")
      .min(2, "Nama tamu minimal 2 karakter")
      .max(100, "Nama tamu maksimal 100 karakter"),
    guestIdType: z
      .union([z.nativeEnum(GuestIdType), z.literal("")])
      .optional()
      .transform((value) => value || null),
    guestIdNumber: OptionalGuestFieldSchema(50),
    guestPhone: OptionalGuestFieldSchema(20),
    guestEmail: OptionalGuestEmailSchema,
    guestNationality: OptionalGuestFieldSchema(50),
    purposeOfVisit: z.enum(purposeOfVisitOptions, {
      error: "Pilih tujuan kunjungan",
    }),
    purposeOfVisitOther: TextOrEmptySchema,
    signatureDataUrl: SignatureDataUrlSchema,
    arrivalConfirmation: BooleanConfirmationSchema,
    depositMethod: z
      .union([
        z.enum(checkInDepositMethods, { error: "Pilih metode deposit" }),
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
        message: "Tuliskan detail tujuan kunjungan",
      });
    }

    if (
      value.depositMethod === PaymentMethod.TRANSFER &&
      !value.depositReference
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["depositReference"],
        message: "Referensi deposit wajib diisi untuk transfer",
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
