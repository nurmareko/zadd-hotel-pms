import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import {
  formatDateID,
  formatDateTimeID,
  formatFixedPercent,
  formatIDR,
} from "@/lib/format";

type StringableDecimal = {
  toString(): string;
};

type NightReportProps = {
  audit: {
    id: number;
    businessDate: Date;
    runAt: Date;
    totalRooms: number;
    roomsOccupied: number;
    occupancyRate: StringableDecimal;
    roomRevenue: StringableDecimal;
    fbRevenue: StringableDecimal;
    otherRevenue: StringableDecimal;
    totalRevenue: StringableDecimal;
    checkInCount: number;
    checkOutCount: number;
    inHouseCount: number;
    runBy: {
      fullName: string;
    };
  };
  settings: {
    hotelName: string;
    address: string | null;
  };
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
    marginTop: 8,
    fontSize: 12,
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
    color: "#22c55e",
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
  table: {
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  tableRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    minHeight: 24,
  },
  tableFirstRow: {
    borderTopWidth: 0,
  },
  cell: {
    paddingHorizontal: 7,
    paddingVertical: 6,
  },
  right: {
    textAlign: "right",
  },
  totalRow: {
    backgroundColor: "#0a0e1a",
    color: "#22c55e",
  },
  totalText: {
    fontSize: 12,
    fontWeight: 700,
  },
  footer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#0a0e1a",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

function dateLabel(date: Date) {
  return formatDateID(date);
}

function dateTimeLabel(date: Date) {
  return formatDateTimeID(date);
}

function percentLabel(value: StringableDecimal) {
  return formatFixedPercent(value.toString());
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

function TableRow({
  label,
  value,
  total = false,
  first = false,
}: {
  label: string;
  value: string;
  total?: boolean;
  first?: boolean;
}) {
  const rowStyle =
    first && total
      ? [styles.tableRow, styles.tableFirstRow, styles.totalRow]
      : first
        ? [styles.tableRow, styles.tableFirstRow]
        : total
          ? [styles.tableRow, styles.totalRow]
          : styles.tableRow;
  const labelStyle = total
    ? [styles.cell, styles.totalText, { width: 260 }]
    : [styles.cell, { width: 260 }];
  const valueStyle = total
    ? [styles.cell, styles.right, styles.totalText, { width: 212 }]
    : [styles.cell, styles.right, { width: 212 }];

  return (
    <View style={rowStyle}>
      <Text style={labelStyle}>{label}</Text>
      <Text style={valueStyle}>{value}</Text>
    </View>
  );
}

export function NightReport({ audit, settings }: NightReportProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.hotelName}>{settings.hotelName}</Text>
          <Text style={styles.muted}>{settings.address ?? "-"}</Text>
          <Text style={styles.title}>
            LAPORAN NIGHT AUDIT · {dateLabel(audit.businessDate)}
          </Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockHeader}>{"AUDIT"}</Text>
          <View style={[styles.blockBody, styles.grid]}>
            <Field label="Audit ID" value={`#${audit.id}`} />
            <Field label="Business Date" value={dateLabel(audit.businessDate)} />
            <Field label="Dijalankan" value={dateTimeLabel(audit.runAt)} />
            <Field label="Run By" value={audit.runBy.fullName} />
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockHeader}>{"OCCUPANCY"}</Text>
          <View style={[styles.blockBody, styles.grid]}>
            <Field label="Occupancy Rate" value={percentLabel(audit.occupancyRate)} />
            <Field
              label="Rooms Occupied / Total"
              value={`${audit.roomsOccupied} / ${audit.totalRooms}`}
            />
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockHeader}>{"MOVEMENT"}</Text>
          <View style={[styles.blockBody, styles.grid]}>
            <Field label="Check-in" value={String(audit.checkInCount)} />
            <Field label="Check-out" value={String(audit.checkOutCount)} />
            <Field label="In-house" value={String(audit.inHouseCount)} />
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockHeader}>{"REVENUE BREAKDOWN"}</Text>
          <View style={styles.blockBody}>
            <View style={styles.table}>
              <TableRow
                label="Pendapatan Kamar"
                value={formatIDR(audit.roomRevenue.toString())}
                first
              />
              <TableRow
                label="Pendapatan F&B"
                value={formatIDR(audit.fbRevenue.toString())}
              />
              <TableRow
                label="Pendapatan Lain"
                value={formatIDR(audit.otherRevenue.toString())}
              />
              <TableRow
                label="TOTAL PENDAPATAN"
                value={formatIDR(audit.totalRevenue.toString())}
                total
              />
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.muted}>Frozen NightAudit snapshot</Text>
          <Text style={styles.muted}>Generated {dateTimeLabel(new Date())}</Text>
        </View>
      </Page>
    </Document>
  );
}
