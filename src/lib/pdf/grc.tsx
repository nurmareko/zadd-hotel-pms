import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { differenceInCalendarDays, format } from "date-fns";
import { id as indonesianLocale } from "date-fns/locale";

import { formatIDR } from "@/lib/format";

type StringableDecimal = {
  toString(): string;
};

type GrcProps = {
  folio: {
    folioNo: string;
  };
  reservation: {
    reservationNo: string;
    arrivalDate: Date;
    departureDate: Date;
    arrangementType: string;
    reservationType: string;
    rateAmount: StringableDecimal;
    adults: number;
    children: number;
    purposeOfVisit: string | null;
    grcFilledAt: Date | null;
    createdBy: {
      fullName: string;
    };
  };
  guest: {
    fullName: string;
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

const arrangementLabels: Record<string, string> = {
  RO: "RO",
  RB: "RB",
  FBM: "FBM",
};

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontFamily: "Courier",
    fontSize: 9,
    color: "#0a0e1a",
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "#0a0e1a",
    paddingBottom: 10,
    marginBottom: 12,
    textAlign: "center",
  },
  hotelName: {
    fontSize: 16,
    fontWeight: 700,
    textTransform: "uppercase",
  },
  muted: {
    color: "#64748b",
  },
  title: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: 700,
    textTransform: "uppercase",
  },
  block: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    marginBottom: 10,
  },
  blockHeader: {
    backgroundColor: "#0a0e1a",
    color: "#00d4aa",
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
  },
  blockBody: {
    padding: 8,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  field: {
    width: "50%",
    marginBottom: 6,
  },
  fieldLabel: {
    color: "#64748b",
    fontSize: 7,
    textTransform: "uppercase",
  },
  fieldValue: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: 700,
  },
  signature: {
    marginTop: 34,
    marginLeft: "auto",
    width: 180,
    textAlign: "center",
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: "#0a0e1a",
    paddingTop: 5,
  },
});

function dateLabel(date: Date) {
  return format(date, "dd MMM yyyy", { locale: indonesianLocale });
}

function dateTimeLabel(date: Date | null) {
  return date
    ? format(date, "dd MMM yyyy HH:mm", { locale: indonesianLocale })
    : "-";
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
  guest,
  room,
  roomType,
  hotelSettings,
}: GrcProps) {
  const nights = differenceInCalendarDays(
    reservation.departureDate,
    reservation.arrivalDate,
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.hotelName}>{hotelSettings.hotelName}</Text>
          <Text style={styles.muted}>{hotelSettings.address ?? "-"}</Text>
          <Text style={styles.title}>GUEST REGISTRATION CARD</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockHeader}>{"// RESERVATION"}</Text>
          <View style={[styles.blockBody, styles.grid]}>
            <Field label="Reservation No" value={reservation.reservationNo} />
            <Field label="Folio No" value={folio.folioNo} />
            <Field label="Arrival" value={dateLabel(reservation.arrivalDate)} />
            <Field
              label="Departure"
              value={dateLabel(reservation.departureDate)}
            />
            <Field label="Nights" value={String(Math.max(0, nights))} />
            <Field
              label="Arrangement"
              value={
                arrangementLabels[reservation.arrangementType] ??
                reservation.arrangementType
              }
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
          <Text style={styles.blockHeader}>{"// GUEST"}</Text>
          <View style={[styles.blockBody, styles.grid]}>
            <Field label="Full Name" value={guest.fullName} />
            <Field label="ID Number" value={guest.idNumber ?? "-"} />
            <Field label="Phone" value={guest.phone ?? "-"} />
            <Field label="Email" value={guest.email ?? "-"} />
            <Field label="Nationality" value={guest.nationality ?? "-"} />
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockHeader}>{"// STAY DETAILS"}</Text>
          <View style={[styles.blockBody, styles.grid]}>
            <Field label="Room" value={room?.number ?? "-"} />
            <Field label="Room Type" value={roomType.name} />
            <Field
              label="Rate"
              value={formatIDR(reservation.rateAmount.toString())}
            />
            <Field label="Adults" value={String(reservation.adults)} />
            <Field label="Children" value={String(reservation.children)} />
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockHeader}>{"// GRC METADATA"}</Text>
          <View style={[styles.blockBody, styles.grid]}>
            <Field
              label="Purpose of Visit"
              value={reservation.purposeOfVisit ?? "-"}
            />
            <Field
              label="Filled At"
              value={dateTimeLabel(reservation.grcFilledAt)}
            />
            <Field label="Filled By" value={reservation.createdBy.fullName} />
          </View>
        </View>

        <View style={styles.signature}>
          <Text style={styles.signatureLine}>Tanda tangan tamu</Text>
        </View>
      </Page>
    </Document>
  );
}
