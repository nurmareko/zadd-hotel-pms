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
import { formatGuestIdentity } from "@/lib/guest-id-type";
import { PDF_BRAND_NAME, printColors, printStyles } from "@/lib/pdf/styles";

type StringableDecimal = {
  toString(): string;
};

type GrcProps = {
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
    signatureDataUrl: string | null;
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
  hotelSettings: {
    hotelName: string;
    address: string | null;
  };
};

const reservationTypeLabels: Record<string, string> = {
  INDIVIDUAL: "Individual",
  COMPANY: "Company",
  GOVERNMENT: "Government",
  OTA: "Online Travel Agent",
  WALK_IN: "Walk-in",
};

const arrangementLabels: Record<ArrangementType, string> = {
  [ArrangementType.RO]: "RO (Room Only)",
  [ArrangementType.BB]: "BB (Bed & Breakfast)",
  [ArrangementType.HB]: "HB (Half Board)",
  [ArrangementType.FB]: "FB (Full Board)",
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

export function Grc({
  folio,
  reservation,
  stayTotal,
  guest,
  room,
  roomType,
  hotelSettings,
}: GrcProps) {
  const nights = differenceInCalendarDays(
    reservation.departureDate,
    reservation.arrivalDate,
  );
  const purposeOfVisit = reservation.purposeOfVisit ?? "______________________";
  const roomNumber = room?.number ?? "belum ditentukan saat check-in";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.hotelName}>{PDF_BRAND_NAME}</Text>
          <Text style={styles.muted}>{hotelSettings.address ?? "-"}</Text>
          <Text style={styles.title}>Guest Registration Card</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockHeader}>{"RESERVATION"}</Text>
          <View style={[styles.blockBody, styles.grid]}>
            <Field label="Reservation No" value={reservation.reservationNo} />
            <Field label="Folio No" value={folio?.folioNo ?? "-"} />
            <Field label="Arrival" value={dateLabel(reservation.arrivalDate)} />
            <Field
              label="Departure"
              value={dateLabel(reservation.departureDate)}
            />
            <Field label="Nights" value={String(Math.max(0, nights))} />
            <Field
              label="Paket menginap"
              value={arrangementLabels[reservation.arrangementType]}
            />
            <Field
              label="Reservation Type"
              value={
                reservationTypeLabels[reservation.reservationType] ??
                reservation.reservationType
              }
            />
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockHeader}>{"GUEST"}</Text>
          <View style={[styles.blockBody, styles.grid]}>
            <Field label="Full Name" value={guest.fullName} />
            <Field
              label="Identity"
              value={formatGuestIdentity(guest.idType, guest.idNumber, "-")}
            />
            <Field label="Phone" value={guest.phone ?? "-"} />
            <Field label="Email" value={guest.email ?? "-"} />
            <Field label="Nationality" value={guest.nationality ?? "-"} />
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockHeader}>{"STAY DETAILS"}</Text>
          <View style={[styles.blockBody, styles.grid]}>
            <Field label="Room" value={roomNumber} />
            <Field label="Room Type" value={roomType.name} />
            <Field
              label="Stay Total"
              value={formatIDR(stayTotal.total.toString())}
            />
            <Field label="Adults" value={String(reservation.adults)} />
            <Field label="Children" value={String(reservation.children)} />
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockHeader}>{"NIGHTLY SCHEDULE"}</Text>
          <View style={styles.blockBody}>
            {stayTotal.nightlySchedule.length > 0 ? (
              stayTotal.nightlySchedule.map((night) => (
                <View key={night.date.toISOString()} style={styles.nightlyRow}>
                  <Text style={styles.nightlyDate}>{dateLabel(night.date)}</Text>
                  <Text style={styles.nightlyRate}>
                    {formatIDR(night.rateAmount.toString())}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.muted}>
                Snapshot malam tidak tersedia; total menggunakan tarif flat.
              </Text>
            )}
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockHeader}>{"GRC METADATA"}</Text>
          <View style={[styles.blockBody, styles.grid]}>
            <Field
              label="Purpose of Visit"
              value={purposeOfVisit}
            />
            <Field
              label="Filled At"
              value={dateTimeLabel(reservation.grcFilledAt)}
            />
            <Field label="Filled By" value={reservation.createdBy.fullName} />
            <Field label="Signed At" value={dateTimeLabel(reservation.signedAt)} />
          </View>
        </View>

        <View style={styles.signature}>
          <View style={styles.signatureImageArea}>
            {reservation.signatureDataUrl ? (
              // @react-pdf/renderer Image is not an HTML img and has no alt prop.
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image
                src={reservation.signatureDataUrl}
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
