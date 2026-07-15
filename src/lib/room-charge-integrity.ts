import { Prisma } from "@prisma/client";

export type LinkedRoomChargeIntegrityInput = {
  id: number;
  fbOrderId: number | null;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  amount: Prisma.Decimal;
  folioReservationId: number;
  reservationNightId: string | null;
  reservationNightReservationId: number | null;
  reservationNightRateAmount: Prisma.Decimal | null;
  serviceDate: Date | null;
  reservationArrivalDate: Date;
  reservationDepartureDate: Date;
};

/**
 * Canonical linked ROOM-CHARGE invariants shared by ARR and the nightly-posting
 * reconciler. Callers may add context-specific checks, but must not weaken these.
 */
export function linkedRoomChargeShapeIssues(
  line: Omit<
    LinkedRoomChargeIntegrityInput,
    | "folioReservationId"
    | "reservationNightReservationId"
    | "reservationArrivalDate"
    | "reservationDepartureDate"
  >,
): string[] {
  const issues: string[] = [];

  if (line.reservationNightId === null || line.serviceDate === null) {
    issues.push("missing ReservationNight identity");
  }
  if (line.fbOrderId !== null) {
    issues.push(`unexpected F&B origin ${line.fbOrderId}`);
  }
  if (!line.quantity.equals(1)) {
    issues.push(`quantity ${line.quantity.toString()} is not 1`);
  }
  if (!line.amount.equals(line.unitPrice)) {
    issues.push(
      `amount ${line.amount.toString()} differs from unit price ${line.unitPrice.toString()}`,
    );
  }
  if (
    line.reservationNightRateAmount !== null &&
    !line.unitPrice.equals(line.reservationNightRateAmount)
  ) {
    issues.push(
      `unit price ${line.unitPrice.toString()} differs from nightly snapshot ${line.reservationNightRateAmount.toString()}`,
    );
  }

  return issues.map((issue) => `line ${line.id}: ${issue}`);
}

export function linkedRoomChargeIntegrityIssues(
  line: LinkedRoomChargeIntegrityInput,
): string[] {
  const issues = linkedRoomChargeShapeIssues(line);

  if (
    line.serviceDate !== null &&
    (line.serviceDate < line.reservationArrivalDate ||
      line.serviceDate >= line.reservationDepartureDate)
  ) {
    issues.push(
      `line ${line.id}: service date ${line.serviceDate.toISOString().slice(0, 10)} is outside reservation stay ${line.reservationArrivalDate.toISOString().slice(0, 10)}–${line.reservationDepartureDate.toISOString().slice(0, 10)} (departure excluded)`,
    );
  }
  if (
    line.reservationNightReservationId === null ||
    line.folioReservationId !== line.reservationNightReservationId
  ) {
    issues.push(
      `line ${line.id}: folio reservation ${line.folioReservationId} differs from night reservation ${line.reservationNightReservationId ?? "missing"}`,
    );
  }

  return issues;
}

export function hasLegacyNightlyRoomChargeShape(line: {
  description: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  amount: Prisma.Decimal;
  reservationRateAmount: Prisma.Decimal;
}): boolean {
  const automaticDescription =
    line.description === "Room charge" ||
    line.description.startsWith("Night Audit Room Charge - ");

  return (
    automaticDescription &&
    line.quantity.equals(1) &&
    line.amount.equals(line.unitPrice) &&
    line.unitPrice.isInteger() &&
    !line.unitPrice.isNegative() &&
    line.unitPrice.equals(line.reservationRateAmount)
  );
}
