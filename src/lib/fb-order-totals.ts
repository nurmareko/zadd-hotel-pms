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

function roundIDR(value: Prisma.Decimal) {
  return value.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
}

export function computeFBOrderTotals(
  lineItems: TotalLine[],
  settings: TotalSettings,
): FBOrderTotals {
  const subtotal = roundIDR(
    lineItems.reduce(
      (sum, lineItem) => sum.plus(toDecimal(lineItem.amount)),
      new Prisma.Decimal(0),
    ),
  );
  const serviceCharge = roundIDR(
    subtotal.mul(toDecimal(settings.serviceChargePercent).div(100)),
  );
  const tax = roundIDR(
    subtotal
      .plus(serviceCharge)
      .mul(toDecimal(settings.taxPercent).div(100)),
  );
  const total = subtotal.plus(serviceCharge).plus(tax);

  return {
    subtotal,
    serviceCharge,
    tax,
    total,
  };
}
