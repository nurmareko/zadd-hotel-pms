import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { ArrangementType, GuestIdType } from "@prisma/client";
import { differenceInCalendarDays, format } from "date-fns";
import { id as legacyIndonesianLocale } from "date-fns/locale";

import { purposeOfVisitLabel } from "@/lib/check-in/schema";
import { formatDateID, formatDateTimeID, formatIDR } from "@/lib/format";
import type { GrcSnapshot } from "@/lib/grc-snapshot";
import { formatGuestIdentity } from "@/lib/guest-id-type";
import { PDF_BRAND_NAME, printColors, printStyles } from "@/lib/pdf/styles";

type StringableDecimal = {
  toString(): string;
};

type LiveGrcSource = {
  kind: "live";
  folio: {
    folioNo: string;
  } | null;
  reservation: {
    reservationNo: string;
    arrivalDate: Date;
    departureDate: Date;
    arrangementType: ArrangementType;
    reservationType: string;
    adults: number;
    children: number;
    purposeOfVisit: string | null;
    grcFilledAt: Date | null;
    signedAt: Date | null;
    createdBy: {
      fullName: string;
    };
  };
  stayTotal: {
    total: StringableDecimal;
    nightlySchedule: Array<{
      date: Date;
      rateAmount: StringableDecimal;
    }>;
  };
  guest: {
    fullName: string;
    idType: GuestIdType | null;
    idNumber: string | null;
    phone: string | null;
    email: string | null;
    nationality: string | null;
  };
  room: {
    number: string;
  } | null;
  roomType: {
    name: string;
  };
  hotelAddress: string | null;
};

type GrcProps = {
  source:
    | LiveGrcSource
    | {
        kind: "snapshot";
        snapshot: GrcSnapshot;
        signatureDataUrl: string;
      };
};

type GrcDocumentData = {
  brandName: string;
  hotelAddress: string;
  reservationNo: string;
  folioNo: string;
  arrivalDate: Date;
  departureDate: Date;
  nights: number;
  arrangementLabel: string;
  reservationTypeLabel: string;
  guest: LiveGrcSource["guest"];
  roomNumber: string;
  roomTypeName: string;
  stayTotal: string;
  adults: number;
  children: number;
  nightlySchedule: Array<{ date: Date; rateAmount: string }>;
  purposeOfVisit: string | null;
  grcFilledAt: Date | null;
  filledByName: string;
  signedAt: Date | null;
  signatureDataUrl: string | null;
};

const reservationTypeLabels: Record<string, string> = {
  INDIVIDUAL: "Individual",
  COMPANY: "Company",
  GOVERNMENT: "Government",
  OTA: "Online Travel Agent (OTA)",
  WALK_IN: "Walk-in",
};

const arrangementLabels: Record<ArrangementType, string> = {
  [ArrangementType.RO]: "RO — Room only",
  [ArrangementType.BB]: "BB — Breakfast",
  [ArrangementType.HB]: "HB — Breakfast + one main meal",
  [ArrangementType.FB]: "FB — Breakfast, lunch, and dinner",
};

// Signed template-1 documents must retain their original presentation.
const legacyTemplateLabels = {
  "Guest Registration Card (GRC)": "Kartu Registrasi Tamu (GRC)",
  "RESERVATION": "RESERVASI",
  "Reservation Number": "Nomor Reservasi",
  "Folio Number": "Nomor Folio",
  "Arrival": "Kedatangan",
  "Departure": "Keberangkatan",
  "Number of Nights": "Jumlah Malam",
  "Arrangement": "Arrangement",
  "Reservation Type": "Jenis Reservasi",
  "GUEST": "TAMU",
  "Full Name": "Nama Lengkap",
  "Identification": "Identitas",
  "Phone": "Telepon",
  "Email": "Email",
  "Nationality": "Kewarganegaraan",
  "STAY DETAILS": "DETAIL MENGINAP",
  "Room": "Kamar",
  "Room Type": "Tipe Kamar",
  "Total Stay Charges": "Total Biaya Menginap",
  "Adults": "Dewasa",
  "Children": "Anak-anak",
  "NIGHTLY RATE SCHEDULE": "JADWAL TARIF PER MALAM",
  "Nightly rate records are unavailable; the total uses a flat rate.": "Rekaman tarif per malam tidak tersedia; total menggunakan tarif tetap.",
  "GRC METADATA": "METADATA GRC",
  "Purpose of Visit": "Tujuan Kunjungan",
  "Filled At": "Waktu Pengisian",
  "Filled By": "Diisi Oleh",
  "Signed At": "Waktu Penandatanganan",
  "Guest Signature": "Tanda Tangan Tamu",
  "Date: ______________________": "Tanggal: ______________________"
} as const;

const styles = StyleSheet.create({
  page: {
    ...printStyles.page,
  },
  header: {
    ...printStyles.centeredHeader,
  },
  hotelName: {
    ...printStyles.hotelName,
  },
  muted: {
    ...printStyles.muted,
  },
  title: {
    ...printStyles.title,
    marginTop: 10,
  },
  block: {
    ...printStyles.block,
  },
  blockHeader: {
    ...printStyles.blockHeader,
  },
  blockBody: {
    ...printStyles.blockBody,
  },
  grid: {
    ...printStyles.grid,
  },
  field: {
    ...printStyles.field,
  },
  fieldLabel: {
    ...printStyles.fieldLabel,
  },
  fieldValue: {
    ...printStyles.fieldValue,
  },
  signature: {
    marginTop: 12,
    marginLeft: "auto",
    width: 180,
    textAlign: "center",
  },
  signatureImageArea: {
    height: 48,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  signatureImage: {
    maxHeight: 44,
    maxWidth: 176,
    objectFit: "contain",
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: printColors.rule,
    paddingTop: 5,
  },
  nightlyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: printColors.rule,
    paddingVertical: 5,
  },
  nightlyDate: {
    ...printStyles.fieldValue,
  },
  nightlyRate: {
    ...printStyles.fieldValue,
    textAlign: "right",
  },
});

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

function documentData(source: GrcProps["source"]): GrcDocumentData {
  if (source.kind === "snapshot") {
    const { snapshot } = source;

    return {
      brandName: snapshot.header.brandName,
      hotelAddress: snapshot.header.hotelAddress,
      reservationNo: snapshot.reservation.reservationNo,
      folioNo: snapshot.reservation.folioNo,
      arrivalDate: new Date(snapshot.reservation.arrival),
      departureDate: new Date(snapshot.reservation.departure),
      nights: snapshot.reservation.nights,
      arrangementLabel: snapshot.reservation.arrangementTypeLabel,
      reservationTypeLabel: snapshot.reservation.reservationTypeLabel,
      guest: snapshot.guest,
      roomNumber: snapshot.stay.roomNumber,
      roomTypeName: snapshot.stay.roomTypeName,
      stayTotal: snapshot.stay.stayTotal,
      adults: snapshot.stay.adults,
      children: snapshot.stay.children,
      nightlySchedule: snapshot.stay.nightlySchedule.map((night) => ({
        date: new Date(night.date),
        rateAmount: night.rateAmount,
      })),
      purposeOfVisit: snapshot.grcMetadata.purposeOfVisit,
      grcFilledAt: snapshot.grcMetadata.grcFilledAt
        ? new Date(snapshot.grcMetadata.grcFilledAt)
        : null,
      filledByName: snapshot.grcMetadata.filledByName,
      signedAt: snapshot.grcMetadata.signedAt
        ? new Date(snapshot.grcMetadata.signedAt)
        : null,
      signatureDataUrl: source.signatureDataUrl,
    };
  }

  return {
    brandName: PDF_BRAND_NAME,
    hotelAddress: source.hotelAddress ?? "-",
    reservationNo: source.reservation.reservationNo,
    folioNo: source.folio?.folioNo ?? "-",
    arrivalDate: source.reservation.arrivalDate,
    departureDate: source.reservation.departureDate,
    nights: Math.max(
      0,
      differenceInCalendarDays(
        source.reservation.departureDate,
        source.reservation.arrivalDate,
      ),
    ),
    arrangementLabel: arrangementLabels[source.reservation.arrangementType],
    reservationTypeLabel:
      reservationTypeLabels[source.reservation.reservationType] ??
      source.reservation.reservationType,
    guest: source.guest,
    roomNumber: source.room?.number ?? "not assigned at check-in",
    roomTypeName: source.roomType.name,
    stayTotal: source.stayTotal.total.toString(),
    adults: source.reservation.adults,
    children: source.reservation.children,
    nightlySchedule: source.stayTotal.nightlySchedule.map((night) => ({
      date: night.date,
      rateAmount: night.rateAmount.toString(),
    })),
    purposeOfVisit: source.reservation.purposeOfVisit === null
      ? null
      : purposeOfVisitLabel(source.reservation.purposeOfVisit),
    grcFilledAt: source.reservation.grcFilledAt,
    filledByName: source.reservation.createdBy.fullName,
    signedAt: source.reservation.signedAt,
    signatureDataUrl: null,
  };
}

export function Grc({ source }: GrcProps) {
  const legacy = source.kind === "snapshot" && source.snapshot.templateVersion === 1;
  const label = (text: keyof typeof legacyTemplateLabels) =>
    legacy ? legacyTemplateLabels[text] : text;
  const dateLabel = (date: Date) => legacy
    ? format(date, "dd MMM yyyy", { locale: legacyIndonesianLocale })
    : formatDateID(date);
  const dateTimeLabel = (date: Date | null) => date
    ? legacy
      ? format(date, "dd MMM yyyy HH:mm", { locale: legacyIndonesianLocale })
      : formatDateTimeID(date)
    : label("Date: ______________________");
  const data = documentData(source);
  const legacyIdentityLabel = legacy && data.guest.idType === GuestIdType.PASSPORT
    ? "Paspor"
    : legacy && data.guest.idType === GuestIdType.OTHER ? "Lainnya" : null;
  const identity = legacyIdentityLabel
    ? data.guest.idNumber
      ? `${legacyIdentityLabel} · ${data.guest.idNumber}`
      : legacyIdentityLabel
    : formatGuestIdentity(data.guest.idType, data.guest.idNumber, "-");
  const purposeOfVisit = data.purposeOfVisit ?? "______________________";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.hotelName}>{data.brandName}</Text>
          <Text style={styles.muted}>{data.hotelAddress}</Text>
          <Text style={styles.title}>{label("Guest Registration Card (GRC)")}</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockHeader}>{label("RESERVATION")}</Text>
          <View style={[styles.blockBody, styles.grid]}>
            <Field label={label("Reservation Number")} value={data.reservationNo} />
            <Field label={label("Folio Number")} value={data.folioNo} />
            <Field label={label("Arrival")} value={dateLabel(data.arrivalDate)} />
            <Field label={label("Departure")} value={dateLabel(data.departureDate)} />
            <Field label={label("Number of Nights")} value={String(data.nights)} />
            <Field label={label("Arrangement")} value={data.arrangementLabel} />
            <Field label={label("Reservation Type")} value={data.reservationTypeLabel} />
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockHeader}>{label("GUEST")}</Text>
          <View style={[styles.blockBody, styles.grid]}>
            <Field label={label("Full Name")} value={data.guest.fullName} />
            <Field
              label={label("Identification")}
              value={identity}
            />
            <Field label={label("Phone")} value={data.guest.phone ?? "-"} />
            <Field label={label("Email")} value={data.guest.email ?? "-"} />
            <Field label={label("Nationality")} value={data.guest.nationality ?? "-"} />
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockHeader}>{label("STAY DETAILS")}</Text>
          <View style={[styles.blockBody, styles.grid]}>
            <Field label={label("Room")} value={data.roomNumber} />
            <Field label={label("Room Type")} value={data.roomTypeName} />
            <Field label={label("Total Stay Charges")} value={formatIDR(data.stayTotal)} />
            <Field label={label("Adults")} value={String(data.adults)} />
            <Field label={label("Children")} value={String(data.children)} />
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockHeader}>{label("NIGHTLY RATE SCHEDULE")}</Text>
          <View style={styles.blockBody}>
            {data.nightlySchedule.length > 0 ? (
              data.nightlySchedule.map((night) => (
                <View key={night.date.toISOString()} style={styles.nightlyRow}>
                  <Text style={styles.nightlyDate}>{dateLabel(night.date)}</Text>
                  <Text style={styles.nightlyRate}>
                    {formatIDR(night.rateAmount)}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.muted}>
                {label("Nightly rate records are unavailable; the total uses a flat rate.")}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockHeader}>{label("GRC METADATA")}</Text>
          <View style={[styles.blockBody, styles.grid]}>
            <Field
              label={label("Purpose of Visit")}
              value={purposeOfVisit}
            />
            <Field
              label={label("Filled At")}
              value={dateTimeLabel(data.grcFilledAt)}
            />
            <Field label={label("Filled By")} value={data.filledByName} />
            <Field label={label("Signed At")} value={dateTimeLabel(data.signedAt)} />
          </View>
        </View>

        <View style={styles.signature}>
          <View style={styles.signatureImageArea}>
            {data.signatureDataUrl ? (
              // @react-pdf/renderer Image is not an HTML img and has no alt prop.
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image
                src={data.signatureDataUrl}
                style={styles.signatureImage}
              />
            ) : null}
          </View>
          <Text style={styles.signatureLine}>{label("Guest Signature")}</Text>
        </View>
      </Page>
    </Document>
  );
}
