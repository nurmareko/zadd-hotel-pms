import { Prisma, type HotelSettings } from "@prisma/client";

export type FBOrderTotals = {
  subtotal: Prisma.Decimal;
  serviceCharge: Prisma.Decimal;
  tax: Prisma.Decimal;
  total: Prisma.Decimal;
};

type TotalLine = {
  amount: Prisma.Decimal | number | string;
};

type TotalSettings = Pick<
  HotelSettings,
  "serviceChargePercent" | "taxPercent"
>;

function toDecimal(value: Prisma.Decimal | number | string) {
  return value instanceof Prisma.Decimal
    ? value
    : new Prisma.Decimal(value);
}

export function computeFBOrderTotals(
  lineItems: TotalLine[],
  settings: TotalSettings,
): FBOrderTotals {
  const subtotal = lineItems.reduce(
    (sum, lineItem) => sum.plus(toDecimal(lineItem.amount)),
    new Prisma.Decimal(0),
  );
  const serviceCharge = subtotal.mul(
    toDecimal(settings.serviceChargePercent).div(100),
  );
  const tax = subtotal
    .plus(serviceCharge)
    .mul(toDecimal(settings.taxPercent).div(100));
  const total = subtotal.plus(serviceCharge).plus(tax);

  return {
    subtotal,
    serviceCharge,
    tax,
    total,
  };
}
