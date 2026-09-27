import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { ArrangementType, GuestIdType } from "@prisma/client";
import { differenceInCalendarDays } from "date-fns";

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
  INDIVIDUAL: "Individu",
  COMPANY: "Perusahaan",
  GOVERNMENT: "Pemerintah",
  OTA: "Agen Perjalanan Online (OTA)",
  WALK_IN: "Walk-in",
};

const arrangementLabels: Record<ArrangementType, string> = {
  [ArrangementType.RO]: "RO — Tanpa makan",
  [ArrangementType.BB]: "BB — Sarapan",
  [ArrangementType.HB]: "HB — Sarapan + satu kali makan utama",
  [ArrangementType.FB]: "FB — Sarapan, makan siang, dan makan malam",
};

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

function dateLabel(date: Date) {
  return formatDateID(date);
}

function dateTimeLabel(date: Date | null) {
  return date ? formatDateTimeID(date) : "Tanggal: ______________________";
}

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
    roomNumber: source.room?.number ?? "belum ditentukan saat check-in",
    roomTypeName: source.roomType.name,
    stayTotal: source.stayTotal.total.toString(),
    adults: source.reservation.adults,
    children: source.reservation.children,
    nightlySchedule: source.stayTotal.nightlySchedule.map((night) => ({
      date: night.date,
      rateAmount: night.rateAmount.toString(),
    })),
    purposeOfVisit: source.reservation.purposeOfVisit,
    grcFilledAt: source.reservation.grcFilledAt,
    filledByName: source.reservation.createdBy.fullName,
    signedAt: source.reservation.signedAt,
    signatureDataUrl: null,
  };
}

export function Grc({ source }: GrcProps) {
  const data = documentData(source);
  const purposeOfVisit = data.purposeOfVisit ?? "______________________";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.hotelName}>{data.brandName}</Text>
          <Text style={styles.muted}>{data.hotelAddress}</Text>
          <Text style={styles.title}>Kartu Registrasi Tamu (GRC)</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockHeader}>{"RESERVASI"}</Text>
          <View style={[styles.blockBody, styles.grid]}>
            <Field label="Nomor Reservasi" value={data.reservationNo} />
            <Field label="Nomor Folio" value={data.folioNo} />
            <Field label="Kedatangan" value={dateLabel(data.arrivalDate)} />
            <Field label="Keberangkatan" value={dateLabel(data.departureDate)} />
            <Field label="Jumlah Malam" value={String(data.nights)} />
            <Field label="Inklusi" value={data.arrangementLabel} />
            <Field label="Jenis Reservasi" value={data.reservationTypeLabel} />
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockHeader}>{"TAMU"}</Text>
          <View style={[styles.blockBody, styles.grid]}>
            <Field label="Nama Lengkap" value={data.guest.fullName} />
            <Field
              label="Identitas"
              value={formatGuestIdentity(
                data.guest.idType,
                data.guest.idNumber,
                "-",
              )}
            />
            <Field label="Telepon" value={data.guest.phone ?? "-"} />
            <Field label="Email" value={data.guest.email ?? "-"} />
            <Field label="Kewarganegaraan" value={data.guest.nationality ?? "-"} />
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockHeader}>{"DETAIL MENGINAP"}</Text>
          <View style={[styles.blockBody, styles.grid]}>
            <Field label="Kamar" value={data.roomNumber} />
            <Field label="Tipe Kamar" value={data.roomTypeName} />
            <Field label="Total Biaya Menginap" value={formatIDR(data.stayTotal)} />
            <Field label="Dewasa" value={String(data.adults)} />
            <Field label="Anak-anak" value={String(data.children)} />
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockHeader}>{"JADWAL TARIF PER MALAM"}</Text>
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
                Rekaman tarif per malam tidak tersedia; total menggunakan tarif tetap.
              </Text>
            )}
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockHeader}>{"METADATA GRC"}</Text>
          <View style={[styles.blockBody, styles.grid]}>
            <Field
              label="Tujuan Kunjungan"
              value={purposeOfVisit}
            />
            <Field
              label="Waktu Pengisian"
              value={dateTimeLabel(data.grcFilledAt)}
            />
            <Field label="Diisi Oleh" value={data.filledByName} />
            <Field label="Waktu Penandatanganan" value={dateTimeLabel(data.signedAt)} />
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
          <Text style={styles.signatureLine}>Tanda Tangan Tamu</Text>
        </View>
      </Page>
    </Document>
  );
}
