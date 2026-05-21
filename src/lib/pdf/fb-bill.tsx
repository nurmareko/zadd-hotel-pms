import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { PaymentMethod } from "@prisma/client";
import { format } from "date-fns";
import { id as indonesianLocale } from "date-fns/locale";

import { type FBOrderTotals } from "@/lib/fb-order-totals";
import { formatIDR } from "@/lib/format";

type StringableDecimal = {
  toString(): string;
};

type FBBillItem = {
  id: number;
  quantity: number;
  unitPrice: StringableDecimal;
  amount: StringableDecimal;
  notes: string | null;
  menuItem: {
    name: string;
  };
};

type FBBillProps = {
  order: {
    orderNo: string;
    guestCount: number;
    openedAt: Date;
    tableNo: string | null;
    table: {
      number: string;
    } | null;
    waitedBy: {
      fullName: string;
    };
    items: FBBillItem[];
  };
  settings: {
    hotelName: string;
    address: string | null;
    taxPercent: StringableDecimal;
    serviceChargePercent: StringableDecimal;
  };
  totals: FBOrderTotals;
  receipt?: {
    paymentMethod: PaymentMethod | null;
    reference?: string | null;
    folioNo?: string | null;
    amountTendered?: string | null;
    change?: string | null;
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
  table: {
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#0a0e1a",
    color: "#00d4aa",
    fontSize: 7,
    fontWeight: 700,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    minHeight: 22,
  },
  cell: {
    paddingHorizontal: 5,
    paddingVertical: 5,
  },
  itemCell: {
    paddingHorizontal: 5,
    paddingVertical: 5,
  },
  note: {
    marginTop: 2,
    color: "#d97706",
    fontSize: 7,
    fontStyle: "italic",
  },
  right: {
    textAlign: "right",
  },
  summary: {
    width: 220,
    marginLeft: "auto",
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 4,
  },
  totalText: {
    fontSize: 12,
    fontWeight: 700,
  },
  strong: {
    fontWeight: 700,
  },
  footer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#0a0e1a",
    paddingTop: 8,
    textAlign: "center",
  },
});

function dateTimeLabel(date: Date) {
  return format(date, "dd MMM yyyy HH:mm", { locale: indonesianLocale });
}

function qtyLabel(quantity: number) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
  }).format(quantity);
}

function percentLabel(percent: StringableDecimal) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
  }).format(Number(percent.toString()));
}

function hasPercent(percent: StringableDecimal) {
  return Number(percent.toString()) > 0;
}

function paymentMethodLabel(method: PaymentMethod | null) {
  if (method === PaymentMethod.CASH) {
    return "Tunai";
  }

  if (method === PaymentMethod.CARD) {
    return "Kartu";
  }

  if (method === PaymentMethod.TRANSFER) {
    return "Transfer";
  }

  if (method === PaymentMethod.CHARGE_TO_ROOM) {
    return "Charge to Room";
  }

  return "-";
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
      <Text style={strong ? styles.totalText : undefined}>{label}</Text>
      <Text style={strong ? styles.totalText : undefined}>{value}</Text>
    </View>
  );
}

export function FBBill({ order, settings, totals, receipt }: FBBillProps) {
  const tableNo = order.table?.number ?? order.tableNo ?? "-";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.hotelName}>{settings.hotelName}</Text>
          <Text style={styles.muted}>{settings.address ?? "-"}</Text>
          <Text style={styles.title}>
            {receipt ? "RECEIPT / STRUK" : "BILL / TAGIHAN"}
          </Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockHeader}>{"// ORDER"}</Text>
          <View style={[styles.blockBody, styles.grid]}>
            <Field label="Order #" value={order.orderNo} />
            <Field label="Meja" value={tableNo} />
            <Field label="Jumlah Tamu" value={`${order.guestCount} pax`} />
            <Field label="Tanggal/Waktu" value={dateTimeLabel(order.openedAt)} />
            <Field label="Kasir" value={order.waitedBy.fullName} />
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockHeader}>{"// ITEMIZED BILL"}</Text>
          <View style={styles.blockBody}>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.cell, { width: 258 }]}>Item</Text>
                <Text style={[styles.cell, styles.right, { width: 42 }]}>Qty</Text>
                <Text style={[styles.cell, styles.right, { width: 86 }]}>
                  Unit
                </Text>
                <Text style={[styles.cell, styles.right, { width: 86 }]}>
                  Amount
                </Text>
              </View>
              {order.items.length === 0 ? (
                <View style={styles.tableRow}>
                  <Text style={[styles.cell, styles.muted, { width: 472 }]}>
                    Order kosong, tidak bisa ditagih.
                  </Text>
                </View>
              ) : (
                order.items.map((item) => (
                  <View key={item.id} style={styles.tableRow}>
                    <View style={[styles.itemCell, { width: 258 }]}>
                      <Text>{item.menuItem.name}</Text>
                      {item.notes ? (
                        <Text style={styles.note}>{item.notes}</Text>
                      ) : null}
                    </View>
                    <Text style={[styles.cell, styles.right, { width: 42 }]}>
                      {qtyLabel(item.quantity)}
                    </Text>
                    <Text style={[styles.cell, styles.right, { width: 86 }]}>
                      {formatIDR(item.unitPrice.toString())}
                    </Text>
                    <Text style={[styles.cell, styles.right, { width: 86 }]}>
                      {formatIDR(item.amount.toString())}
                    </Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.summary}>
              <SummaryRow label="Subtotal" value={formatIDR(totals.subtotal.toString())} />
              {hasPercent(settings.serviceChargePercent) ? (
                <SummaryRow
                  label={`SC ${percentLabel(settings.serviceChargePercent)}%`}
                  value={formatIDR(totals.serviceCharge.toString())}
                />
              ) : null}
              {hasPercent(settings.taxPercent) ? (
                <SummaryRow
                  label={`Tax ${percentLabel(settings.taxPercent)}%`}
                  value={formatIDR(totals.tax.toString())}
                />
              ) : null}
              <SummaryRow
                label="TOTAL"
                value={formatIDR(totals.total.toString())}
                strong
              />
            </View>
          </View>
        </View>

        {receipt ? (
          <View style={styles.block}>
            <Text style={styles.blockHeader}>{"// PAYMENT"}</Text>
            <View style={styles.blockBody}>
              <SummaryRow
                label="Metode"
                value={paymentMethodLabel(receipt.paymentMethod)}
              />
              {receipt.reference ? (
                <SummaryRow label="Referensi" value={receipt.reference} />
              ) : null}
              {receipt.folioNo ? (
                <SummaryRow label="Folio" value={receipt.folioNo} />
              ) : null}
              {receipt.paymentMethod === PaymentMethod.CASH &&
              receipt.amountTendered ? (
                <SummaryRow
                  label="Uang diterima"
                  value={formatIDR(receipt.amountTendered)}
                />
              ) : null}
              {receipt.paymentMethod === PaymentMethod.CASH && receipt.change ? (
                <SummaryRow label="Kembalian" value={formatIDR(receipt.change)} />
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text style={styles.strong}>Terima kasih atas kunjungan Anda</Text>
        </View>
      </Page>
    </Document>
  );
}
