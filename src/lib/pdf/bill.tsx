import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { PaymentPurpose } from "@prisma/client";

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
  purpose: PaymentPurpose;
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

const paymentPurposeLabels: Record<PaymentPurpose, string> = {
  [PaymentPurpose.DEPOSIT]: "Deposit",
  [PaymentPurpose.PAYMENT]: "Pembayaran",
  [PaymentPurpose.SETTLEMENT]: "Pelunasan",
};

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
          <Text style={styles.title}>Tagihan Tamu</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockHeader}>{"RESERVASI"}</Text>
          <View style={[styles.blockBody, styles.grid]}>
            <Field label="Tamu" value={folio.reservation.guest.fullName} />
            <Field label="Kamar" value={folio.reservation.room?.number ?? "-"} />
            <Field label="Reservasi" value={folio.reservation.reservationNo} />
            <Field label="Folio" value={folio.folioNo} />
            <Field
              label="Kedatangan"
              value={dateLabel(folio.reservation.arrivalDate)}
            />
            <Field
              label="Keberangkatan"
              value={dateLabel(folio.reservation.departureDate)}
            />
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockHeader}>{"RINCIAN BIAYA"}</Text>
          <View style={styles.blockBody}>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.cell, { width: 58 }]}>Tanggal</Text>
                <Text style={[styles.cell, { width: 206 }]}>Deskripsi</Text>
                <Text style={[styles.cell, styles.right, { width: 40 }]}>Jumlah</Text>
                <Text style={[styles.cell, styles.right, { width: 82 }]}>
                  Tarif Satuan
                </Text>
                <Text style={[styles.cell, styles.right, { width: 86 }]}>
                  Total (Rp)
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
                label={`Biaya layanan ${settings.serviceChargePercent.toString()}%`}
                value={formatIDR(totals.serviceCharge)}
              />
              <SummaryRow
                label={`Pajak ${settings.taxPercent.toString()}%`}
                value={formatIDR(totals.tax)}
              />
              {totals.inclusiveCharges > 0 ? (
                <SummaryRow
                  label="F&B Inklusif"
                  value={formatIDR(totals.inclusiveCharges)}
                />
              ) : null}
              <SummaryRow
                label="Total"
                value={formatIDR(totals.totalCharges)}
                strong
              />
            </View>
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockHeader}>{"PEMBAYARAN"}</Text>
          <View style={styles.blockBody}>
            {folio.payments.length === 0 ? (
              <Text style={styles.muted}>Belum ada pembayaran.</Text>
            ) : (
              folio.payments.map((payment) => (
                <View key={payment.id} style={styles.summaryRow}>
                  <Text>
                    {paymentPurposeLabels[payment.purpose]} ·{" "}
                    {dateTimeLabel(payment.receivedAt)} · {payment.method}
                    {payment.reference ? ` · ${payment.reference}` : ""}
                  </Text>
                  <Text>{formatIDR(payment.amount.toString())}</Text>
                </View>
              ))
            )}
            <View style={styles.summary}>
              <SummaryRow
                label="Total Pembayaran"
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
          <Text>Tanggal operasional: {dateLabel(businessDate)}</Text>
        </View>
      </Page>
    </Document>
  );
}
