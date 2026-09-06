import {
  Prisma,
  type Article,
  type FolioLineItem,
  type HotelSettings,
  type Payment,
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

function roundIDR(amount: Prisma.Decimal) {
  return Math.round(amount.toNumber());
}

function isLinkedFBOrderLine(lineItem: FolioLineItem) {
  return typeof lineItem.fbOrderId === "number";
}

export function computeFolioTotals(
  lineItems: (FolioLineItem & { article: Article })[],
  payments: Payment[],
  settings: HotelSettings,
): FolioTotals {
  const inclusiveLines = lineItems.filter(isLinkedFBOrderLine);
  const baseLines = lineItems.filter(
    (lineItem) =>
      !isLinkedFBOrderLine(lineItem) &&
      !["TAX", "SERVICE"].includes(lineItem.article.type),
  );
  const extraLines = lineItems.filter(
    (lineItem) =>
      !isLinkedFBOrderLine(lineItem) &&
      ["TAX", "SERVICE"].includes(lineItem.article.type),
  );

  // Folios settle in whole IDR. Keep the policy in this canonical read-time
  // calculation: stay-charge posting remains count-based and unchanged.
  const subtotal = roundIDR(
    baseLines.reduce(
      (sum, lineItem) => sum.plus(lineItem.amount),
      new Prisma.Decimal(0),
    ),
  );
  const serviceCharge = roundIDR(
    new Prisma.Decimal(subtotal).mul(settings.serviceChargePercent).div(100),
  );
  const tax = roundIDR(
    new Prisma.Decimal(subtotal)
      .plus(serviceCharge)
      .mul(settings.taxPercent)
      .div(100),
  );
  const taxableExtras = roundIDR(
    extraLines.reduce(
      (sum, lineItem) => sum.plus(lineItem.amount),
      new Prisma.Decimal(0),
    ),
  );
  const inclusiveCharges = roundIDR(
    inclusiveLines.reduce(
      (sum, lineItem) => sum.plus(lineItem.amount),
      new Prisma.Decimal(0),
    ),
  );

  const totalCharges =
    subtotal + serviceCharge + tax + taxableExtras + inclusiveCharges;
  const totalPaid = roundIDR(
    payments.reduce(
      (sum, payment) => sum.plus(payment.amount),
      new Prisma.Decimal(0),
    ),
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
