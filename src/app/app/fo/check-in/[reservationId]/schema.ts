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

const MoneySchema = z.preprocess(
  (value) =>
    (typeof value === "string" && value.trim() === "") || value == null
      ? 0
      : value,
  z.coerce
    .number("Jumlah deposit harus berupa angka")
    .min(0, "Jumlah deposit tidak boleh negatif"),
);

const SignatureDataUrlSchema = z
  .string()
  .min(1, "Tanda tangan tamu wajib diisi")
  .max(2_000_000, "Ukuran tanda tangan terlalu besar. Hapus lalu coba lagi.")
  .regex(
    /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/,
    "Format tanda tangan tidak valid. Hapus lalu coba lagi.",
  );

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
    depositAmount: MoneySchema,
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

    if (value.depositAmount > 0 && !value.depositMethod) {
      ctx.addIssue({
        code: "custom",
        path: ["depositMethod"],
        message: "Pilih metode deposit",
      });
    }

    if (
      value.depositAmount > 0 &&
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
    depositMethod: value.depositAmount > 0 ? value.depositMethod : null,
    depositReference: value.depositReference || null,
  }));

export type CheckInInput = z.input<typeof CheckInSchema>;
export type CheckInValues = z.output<typeof CheckInSchema>;
export type PurposeOfVisitValue = (typeof purposeOfVisitOptions)[number];
export type CheckInDepositMethod = (typeof checkInDepositMethods)[number];
