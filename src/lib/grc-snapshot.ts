import { createHash } from "node:crypto";

import {
  ArrangementType,
  GuestIdType,
  Prisma,
  ReservationType,
} from "@prisma/client";
import { differenceInCalendarDays } from "date-fns";
import { z } from "zod";

import { flatReservationNightStayTotal } from "@/lib/flat-reservation-night-total";
import { PDF_BRAND_NAME } from "@/lib/pdf/styles";

export const GRC_SNAPSHOT_SCHEMA_VERSION = 1;
export const GRC_TEMPLATE_VERSION = 1;

// These labels freeze the unchanged Phase 1 GRC template. Any renderer label
// change must intentionally bump GRC_TEMPLATE_VERSION and migrate Phase 2 reads.
const reservationTypeLabels: Record<ReservationType, string> = {
  [ReservationType.INDIVIDUAL]: "Individual",
  [ReservationType.COMPANY]: "Company",
  [ReservationType.GOVERNMENT]: "Government",
  [ReservationType.OTA]: "Online Travel Agent",
  [ReservationType.WALK_IN]: "Walk-in",
};

const arrangementLabels: Record<ArrangementType, string> = {
  [ArrangementType.RO]: "RO — Tanpa makan",
  [ArrangementType.BB]: "BB — Sarapan",
  [ArrangementType.HB]: "HB — Sarapan + satu kali makan utama",
  [ArrangementType.FB]: "FB — Sarapan, makan siang, dan makan malam",
};

const IsoDateTimeSchema = z.string().datetime();
const DecimalStringSchema = z.string().regex(/^\d+(?:\.\d+)?$/);

export const GrcSnapshotSchema = z
  .object({
    schemaVersion: z.literal(GRC_SNAPSHOT_SCHEMA_VERSION),
    templateVersion: z.literal(GRC_TEMPLATE_VERSION),
    capturedAt: IsoDateTimeSchema,
    header: z
      .object({
        brandName: z.string(),
        hotelAddress: z.string(),
      })
      .strict(),
    reservation: z
      .object({
        reservationNo: z.string(),
        folioNo: z.string(),
        arrival: IsoDateTimeSchema,
        departure: IsoDateTimeSchema,
        nights: z.number().int().nonnegative(),
        arrangementType: z.nativeEnum(ArrangementType),
        arrangementTypeLabel: z.string(),
        reservationType: z.nativeEnum(ReservationType),
        reservationTypeLabel: z.string(),
      })
      .strict(),
    guest: z
      .object({
        fullName: z.string(),
        idType: z.nativeEnum(GuestIdType).nullable(),
        idNumber: z.string().nullable(),
        phone: z.string().nullable(),
        email: z.string().nullable(),
        nationality: z.string().nullable(),
      })
      .strict(),
    stay: z
      .object({
        roomNumber: z.string(),
        roomTypeName: z.string(),
        adults: z.number().int().nonnegative(),
        children: z.number().int().nonnegative(),
        stayTotal: DecimalStringSchema,
        usesNightlyRates: z.boolean(),
        nightlySchedule: z.array(
          z
            .object({
              date: IsoDateTimeSchema,
              rateAmount: DecimalStringSchema,
            })
            .strict(),
        ),
      })
      .strict(),
    grcMetadata: z
      .object({
        purposeOfVisit: z.string().nullable(),
        grcFilledAt: IsoDateTimeSchema.nullable(),
        filledByName: z.string(),
        signedAt: IsoDateTimeSchema.nullable(),
      })
      .strict(),
    signatureSha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export type GrcSnapshot = z.infer<typeof GrcSnapshotSchema>;

type SnapshotSource = {
  reservationNo: string;
  arrivalDate: Date;
  departureDate: Date;
  arrangementType: ArrangementType;
  reservationType: ReservationType;
  adults: number;
  children: number;
  rateAmount: Prisma.Decimal;
  purposeOfVisit: string | null;
  grcFilledAt: Date | null;
  signatureDataUrl: string | null;
  signedAt: Date | null;
  folio: { folioNo: string } | null;
  guest: {
    fullName: string;
    idType: GuestIdType | null;
    idNumber: string | null;
    phone: string | null;
    email: string | null;
    nationality: string | null;
  };
  room: { number: string } | null;
  roomType: { name: string };
  reservationNights: Array<{
    date: Date;
    rateAmount: Prisma.Decimal;
  }>;
};

export function buildGrcSnapshot({
  reservation,
  hotelAddress,
  filledByName,
  capturedAt,
}: {
  reservation: SnapshotSource;
  hotelAddress: string | null;
  filledByName: string;
  capturedAt: Date;
}): GrcSnapshot {
  if (!reservation.signatureDataUrl) {
    throw new Error("Cannot capture a GRC snapshot without a signature");
  }

  const stayTotal = flatReservationNightStayTotal({
    arrivalDate: reservation.arrivalDate,
    departureDate: reservation.departureDate,
    rateAmount: reservation.rateAmount,
    reservationNights: reservation.reservationNights,
  });

  return GrcSnapshotSchema.parse({
    schemaVersion: GRC_SNAPSHOT_SCHEMA_VERSION,
    templateVersion: GRC_TEMPLATE_VERSION,
    capturedAt: capturedAt.toISOString(),
    header: {
      brandName: PDF_BRAND_NAME,
      hotelAddress: hotelAddress ?? "-",
    },
    reservation: {
      reservationNo: reservation.reservationNo,
      folioNo: reservation.folio?.folioNo ?? "-",
      arrival: reservation.arrivalDate.toISOString(),
      departure: reservation.departureDate.toISOString(),
      nights: Math.max(
        0,
        differenceInCalendarDays(
          reservation.departureDate,
          reservation.arrivalDate,
        ),
      ),
      arrangementType: reservation.arrangementType,
      arrangementTypeLabel: arrangementLabels[reservation.arrangementType],
      reservationType: reservation.reservationType,
      reservationTypeLabel: reservationTypeLabels[reservation.reservationType],
    },
    guest: reservation.guest,
    stay: {
      roomNumber: reservation.room?.number ?? "belum ditentukan saat check-in",
      roomTypeName: reservation.roomType.name,
      adults: reservation.adults,
      children: reservation.children,
      stayTotal: stayTotal.total.toString(),
      usesNightlyRates: stayTotal.usesNightlyRates,
      nightlySchedule: stayTotal.nightlySchedule.map((night) => ({
        date: night.date.toISOString(),
        rateAmount: night.rateAmount.toString(),
      })),
    },
    grcMetadata: {
      purposeOfVisit: reservation.purposeOfVisit,
      grcFilledAt: reservation.grcFilledAt?.toISOString() ?? null,
      filledByName,
      signedAt: reservation.signedAt?.toISOString() ?? null,
    },
    signatureSha256: createHash("sha256")
      .update(reservation.signatureDataUrl, "utf8")
      .digest("hex"),
  });
}
