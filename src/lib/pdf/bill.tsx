import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import {
  billBalanceAmountLabel,
  billBalanceLabel,
  folioBalanceState,
  refundDueNote,
} from "@/lib/folio-balance-display";
import {
  formatDateID,
  formatDateTimeID,
  formatDecimalID,
  formatIDR,
  formatMonthDayID,
} from "@/lib/format";
import { PDF_BRAND_NAME, printStyles } from "@/lib/pdf/styles";
import type { FolioTotals } from "@/lib/folio-totals";

type StringableDecimal = {
  toString(): string;
};

type BillLineItem = {
  id: number;
  description: string;
  quantity: StringableDecimal;
  unitPrice: StringableDecimal;
  amount: StringableDecimal;
  postedAt: Date;
  article: {
    name: string;
  };
};

type BillPayment = {
  id: number;
  amount: StringableDecimal;
  method: string;
  reference: string | null;
  receivedAt: Date;
};

type BillProps = {
  folio: {
    folioNo: string;
    closedAt: Date | null;
    reservation: {
      reservationNo: string;
      arrivalDate: Date;
      departureDate: Date;
      guest: {
        fullName: string;
      };
      room: {
        number: string;
      } | null;
    };
    lineItems: BillLineItem[];
    payments: BillPayment[];
  };
  settings: {
    hotelName: string;
    address: string | null;
    taxPercent: StringableDecimal;
    serviceChargePercent: StringableDecimal;
  };
  totals: FolioTotals;
  businessDate: Date;
};

const styles = StyleSheet.create({
  page: {
    ...printStyles.page,
  },
  header: {
    ...printStyles.header,
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
  table: {
    ...printStyles.table,
  },
  tableHeader: {
    ...printStyles.tableHeader,
  },
  tableRow: {
    ...printStyles.tableRow,
  },
  cell: {
    ...printStyles.cell,
  },
  right: {
    ...printStyles.right,
  },
  summary: {
    ...printStyles.summary,
  },
  summaryRow: {
    ...printStyles.summaryRow,
  },
  strong: {
    ...printStyles.strong,
  },
  footer: {
    ...printStyles.footer,
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

function qtyLabel(quantity: StringableDecimal) {
  return formatDecimalID(quantity.toString());
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text>{label}</Text>
      <Text style={strong ? styles.strong : undefined}>{value}</Text>
    </View>
  );
}

export function Bill({ folio, settings, totals, businessDate }: BillProps) {
  const balanceState = folioBalanceState(totals.balance);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.hotelName}>{PDF_BRAND_NAME}</Text>
          <Text style={styles.muted}>{settings.address ?? "-"}</Text>
          <Text style={styles.title}>Guest Bill</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockHeader}>{"RESERVATION"}</Text>
          <View style={[styles.blockBody, styles.grid]}>
            <Field label="Guest" value={folio.reservation.guest.fullName} />
            <Field label="Room" value={folio.reservation.room?.number ?? "-"} />
            <Field label="Reservation" value={folio.reservation.reservationNo} />
            <Field label="Folio" value={folio.folioNo} />
            <Field
              label="Arrival"
              value={dateLabel(folio.reservation.arrivalDate)}
            />
            <Field
              label="Departure"
              value={dateLabel(folio.reservation.departureDate)}
            />
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockHeader}>{"LINE ITEMS"}</Text>
          <View style={styles.blockBody}>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.cell, { width: 58 }]}>Date</Text>
                <Text style={[styles.cell, { width: 206 }]}>Description</Text>
                <Text style={[styles.cell, styles.right, { width: 40 }]}>Qty</Text>
                <Text style={[styles.cell, styles.right, { width: 82 }]}>
                  Unit
                </Text>
                <Text style={[styles.cell, styles.right, { width: 86 }]}>
                  Amount
                </Text>
              </View>
              {folio.lineItems.length === 0 ? (
                <View style={styles.tableRow}>
                  <Text style={[styles.cell, styles.muted, { width: 472 }]}>
                    Belum ada tagihan.
                  </Text>
                </View>
              ) : (
                folio.lineItems.map((lineItem) => (
                  <View key={lineItem.id} style={styles.tableRow}>
                    <Text style={[styles.cell, { width: 58 }]}>
                      {formatMonthDayID(lineItem.postedAt)}
                    </Text>
                    <Text style={[styles.cell, { width: 206 }]}>
                      {lineItem.description || lineItem.article.name}
                    </Text>
                    <Text style={[styles.cell, styles.right, { width: 40 }]}>
                      {qtyLabel(lineItem.quantity)}
                    </Text>
                    <Text style={[styles.cell, styles.right, { width: 82 }]}>
                      {formatIDR(lineItem.unitPrice.toString())}
                    </Text>
                    <Text style={[styles.cell, styles.right, { width: 86 }]}>
                      {formatIDR(lineItem.amount.toString())}
                    </Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.summary}>
              <SummaryRow label="Subtotal" value={formatIDR(totals.subtotal)} />
              <SummaryRow
                label={`SC ${settings.serviceChargePercent.toString()}%`}
                value={formatIDR(totals.serviceCharge)}
              />
              <SummaryRow
                label={`Tax ${settings.taxPercent.toString()}%`}
                value={formatIDR(totals.tax)}
              />
              <SummaryRow
                label="Total"
                value={formatIDR(totals.totalCharges)}
                strong
              />
            </View>
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockHeader}>{"PAYMENTS"}</Text>
          <View style={styles.blockBody}>
            {folio.payments.length === 0 ? (
              <Text style={styles.muted}>Belum ada pembayaran.</Text>
            ) : (
              folio.payments.map((payment) => (
                <View key={payment.id} style={styles.summaryRow}>
                  <Text>
                    {dateTimeLabel(payment.receivedAt)} · {payment.method}
                    {payment.reference ? ` · ${payment.reference}` : ""}
                  </Text>
                  <Text>{formatIDR(payment.amount.toString())}</Text>
                </View>
              ))
            )}
            <View style={styles.summary}>
              <SummaryRow
                label="Total Paid"
                value={formatIDR(totals.totalPaid)}
                strong
              />
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <View>
            <Text style={styles.strong}>
              {billBalanceLabel(totals.balance)}:{" "}
              {billBalanceAmountLabel(totals.balance)}
            </Text>
            {balanceState === "credit" ? (
              <Text style={styles.muted}>{refundDueNote(totals.balance)}</Text>
            ) : null}
          </View>
          <Text>Business date: {dateLabel(businessDate)}</Text>
        </View>
      </Page>
    </Document>
  );
}
