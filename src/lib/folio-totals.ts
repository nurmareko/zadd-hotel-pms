import type {
  Article,
  FolioLineItem,
  HotelSettings,
  Payment,
} from "@prisma/client";

export type FolioTotals = {
  subtotal: number;
  serviceCharge: number;
  tax: number;
  taxableExtras: number;
  totalCharges: number;
  totalPaid: number;
  balance: number;
};

export function computeFolioTotals(
  lineItems: (FolioLineItem & { article: Article })[],
  payments: Payment[],
  settings: HotelSettings,
): FolioTotals {
  const baseLines = lineItems.filter(
    (lineItem) => !["TAX", "SERVICE"].includes(lineItem.article.type),
  );
  const extraLines = lineItems.filter((lineItem) =>
    ["TAX", "SERVICE"].includes(lineItem.article.type),
  );

  // Prisma Decimal is converted to Number here for MVP display/totals.
  // Strict accounting would keep decimal arithmetic through the full pipeline.
  const subtotal = baseLines.reduce(
    (sum, lineItem) => sum + Number(lineItem.amount),
    0,
  );
  const serviceCharge =
    subtotal * (Number(settings.serviceChargePercent) / 100);
  const tax = (subtotal + serviceCharge) * (Number(settings.taxPercent) / 100);
  const taxableExtras = extraLines.reduce(
    (sum, lineItem) => sum + Number(lineItem.amount),
    0,
  );

  const totalCharges = subtotal + serviceCharge + tax + taxableExtras;
  const totalPaid = payments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );
  const balance = totalCharges - totalPaid;

  return {
    subtotal,
    serviceCharge,
    tax,
    taxableExtras,
    totalCharges,
    totalPaid,
    balance,
  };
}
