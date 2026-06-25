import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { RoomStatus } from "@prisma/client";

import { formatDateID } from "@/lib/format";
import type {
  HousekeepingCleaningState,
  HousekeepingListRow,
} from "@/lib/housekeeping-list-data";
import { PDF_BRAND_NAME, printColors, printStyles } from "@/lib/pdf/styles";

type HotelSettings = {
  hotelName: string;
  address: string | null;
};

export type HkDailyListHousekeeperSection = {
  id: number;
  name: string;
  initials: string;
  assignedCount: number;
  rows: HousekeepingListRow[];
};

export type HkDailyListProps = {
  date: Date;
  settings: HotelSettings;
  housekeepers: HkDailyListHousekeeperSection[];
  unassignedRows: HousekeepingListRow[];
};

const styles = StyleSheet.create({
  page: {
    ...printStyles.compactPage,
  },
  header: {
    ...printStyles.header,
    paddingBottom: 9,
    marginBottom: 10,
  },
  hotelName: {
    ...printStyles.hotelName,
  },
  muted: {
    ...printStyles.muted,
  },
  title: {
    ...printStyles.title,
  },
  summary: {
    marginBottom: 10,
    color: printColors.muted,
  },
  section: {
    ...printStyles.block,
    marginBottom: 9,
  },
  sectionHeader: {
    ...printStyles.blockHeader,
  },
  sectionMeta: {
    color: printColors.muted,
  },
  empty: {
    padding: 8,
    color: printColors.muted,
    fontStyle: "italic",
  },
  table: {
    borderTopWidth: 1,
    borderTopColor: printColors.rule,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: printColors.lightRule,
    minHeight: 34,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  headerRow: {
    backgroundColor: printColors.headerFill,
    minHeight: 18,
  },
  cell: {
    paddingHorizontal: 5,
    paddingVertical: 5,
  },
  headCell: {
    paddingHorizontal: 5,
    paddingVertical: 4,
    fontSize: 7,
    fontWeight: 700,
    color: printColors.text,
  },
  roomCell: {
    width: 82,
  },
  statusCell: {
    width: 54,
  },
  reservationCell: {
    width: 150,
  },
  noteCell: {
    width: 214,
  },
  strong: {
    fontWeight: 700,
  },
  tiny: {
    marginTop: 2,
    fontSize: 7,
    color: printColors.muted,
  },
  line: {
    marginBottom: 2,
  },
});

const statusLabels: Record<RoomStatus, string> = {
  VC: "VC",
  OC: "OC",
  VD: "VD",
  OD: "OD",
  VCU: "VCU",
  OOO: "OOO",
};

function stateLabel(state: HousekeepingCleaningState) {
  return state === "IN_PROGRESS" ? "BERJALAN" : statusLabels[state];
}

function reservationLabel(row: HousekeepingListRow) {
  if (row.reservationContexts.length === 0) {
    return <Text style={styles.tiny}>Tidak ada aktivitas</Text>;
  }

  return (
    <>
      {row.reservationContexts.map((context) => (
        <Text
          key={`${context.kind}-${context.reservationNo}`}
          style={styles.line}
        >
          <Text style={styles.strong}>{context.label}</Text>
          {` - ${context.guestName} - ${context.nightsLabel}`}
          {context.etaLabel ? ` - ETA ${context.etaLabel}` : ""}
          {` - ${context.reservationNo}`}
        </Text>
      ))}
    </>
  );
}

function noteLabel(row: HousekeepingListRow) {
  if (!row.note) {
    return <Text style={styles.tiny}>-</Text>;
  }

  return (
    <>
      <Text style={styles.line}>{row.note.reservationNo}</Text>
      <Text style={styles.tiny}>
        {row.note.notes ?? "Tidak ada catatan reservasi"}
      </Text>
    </>
  );
}

function TableHeader() {
  return (
    <View style={[styles.row, styles.headerRow]}>
      <Text style={[styles.headCell, styles.roomCell]}>Kamar / Tipe</Text>
      <Text style={[styles.headCell, styles.statusCell]}>Status</Text>
      <Text style={[styles.headCell, styles.reservationCell]}>
        Reservasi
      </Text>
      <Text style={[styles.headCell, styles.noteCell]}>Catatan</Text>
    </View>
  );
}

function RoomRow({
  row,
  last,
}: {
  row: HousekeepingListRow;
  last: boolean;
}) {
  return (
    <View style={last ? [styles.row, styles.lastRow] : styles.row}>
      <View style={[styles.cell, styles.roomCell]}>
        <Text style={styles.strong}>{row.room.number}</Text>
        <Text style={styles.tiny}>
          {row.room.typeCode} - {row.room.typeName}
        </Text>
        <Text style={styles.tiny}>{row.serviceLabel}</Text>
      </View>
      <View style={[styles.cell, styles.statusCell]}>
        <Text style={styles.strong}>{stateLabel(row.cleaningState)}</Text>
        <Text style={styles.tiny}>Status kamar {statusLabels[row.room.status]}</Text>
      </View>
      <View style={[styles.cell, styles.reservationCell]}>
        {reservationLabel(row)}
      </View>
      <View style={[styles.cell, styles.noteCell]}>{noteLabel(row)}</View>
    </View>
  );
}

function Section({
  title,
  count,
  rows,
}: {
  title: string;
  count: number;
  rows: HousekeepingListRow[];
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>
        {title} <Text style={styles.sectionMeta}>- {count} kamar</Text>
      </Text>
      {rows.length === 0 ? (
        <Text style={styles.empty}>Tidak ada kamar ditugaskan.</Text>
      ) : (
        <View style={styles.table}>
          <TableHeader />
          {rows.map((row, index) => (
            <RoomRow
              key={row.room.id}
              row={row}
              last={index === rows.length - 1}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export function HkDailyList({
  date,
  settings,
  housekeepers,
  unassignedRows,
}: HkDailyListProps) {
  const assignedTotal = housekeepers.reduce(
    (total, housekeeper) => total + housekeeper.assignedCount,
    0,
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.hotelName}>{PDF_BRAND_NAME}</Text>
          <Text style={styles.muted}>{settings.address ?? "-"}</Text>
          <Text style={styles.title}>
            Daily Housekeeping List - {formatDateID(date)}
          </Text>
        </View>

        <Text style={styles.summary}>
          Kamar ditugaskan: {assignedTotal} - Belum ditugaskan (perlu
          perhatian): {unassignedRows.length}
        </Text>

        {housekeepers.map((housekeeper) => (
          <Section
            key={housekeeper.id}
            title={`${housekeeper.name} [${housekeeper.initials}]`}
            count={housekeeper.assignedCount}
            rows={housekeeper.rows}
          />
        ))}

        <Section
          title="Belum ditugaskan"
          count={unassignedRows.length}
          rows={unassignedRows}
        />
      </Page>
    </Document>
  );
}
