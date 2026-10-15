import {
  checkActionAuthorization,
  safelyRunAction,
} from "@/lib/action-errors";
import type { Capability } from "@/lib/permissions";

export const RESERVATION_FAILURE_CODES = [
  "SESSION_EXPIRED",
  "FORBIDDEN",
  "INVALID_RESERVATION_DATA",
  "RESERVATION_NOT_FOUND",
  "RESERVATION_CONFLICT",
  "ROOM_UNAVAILABLE",
  "INVALID_ROOM_TYPE",
  "INVALID_ROOM",
  "ROOM_OOO",
  "ROOM_BLOCKED",
  "POST_CHECK_IN_EDIT_RESTRICTED",
  "PRICING_QUOTE_FAILED",
  "STAY_FEE_UNAVAILABLE",
  "CANCELLATION_FAILED",
  "UNEXPECTED_FAILURE",
] as const;

export type ReservationFailureCode =
  (typeof RESERVATION_FAILURE_CODES)[number];

export type ReservationActionField =
  | "fullName"
  | "idType"
  | "idNumber"
  | "phone"
  | "email"
  | "address"
  | "nationality"
  | "roomTypeId"
  | "roomId"
  | "arrivalDate"
  | "departureDate"
  | "adults"
  | "children"
  | "reservationType"
  | "arrangementType"
  | "notes"
  | "stayFeeKinds"
  | "rooms"
  | `rooms.${number}.roomTypeId`
  | `rooms.${number}.roomId`
  | `rooms.${number}.adults`
  | `rooms.${number}.children`;

export type ReservationFailure = {
  ok: false;
  code: ReservationFailureCode;
  error: string;
  field?: ReservationActionField;
};

export type ReservationActionResult = { ok: true } | ReservationFailure;

const RESERVATION_FAILURE_MESSAGES: Record<ReservationFailureCode, string> = {
  SESSION_EXPIRED: "Your session has expired. Please sign in again.",
  FORBIDDEN: "You do not have permission to perform this action.",
  INVALID_RESERVATION_DATA:
    "Invalid reservation data. Check the form.",
  RESERVATION_NOT_FOUND:
    "Reservation not found. Reload the page or return to the reservation list.",
  RESERVATION_CONFLICT:
    "The reservation has changed since this page was opened. Reload the data and try again.",
  ROOM_UNAVAILABLE:
    "The selected room is no longer available for those dates. Select another room.",
  INVALID_ROOM_TYPE: "The selected room type is invalid.",
  INVALID_ROOM: "The selected room is invalid.",
  ROOM_OOO:
    "The selected room is Out of Order (OOO) and cannot be reserved.",
  ROOM_BLOCKED: "The selected room is blocked during the stay. Select another room or different dates.",
  POST_CHECK_IN_EDIT_RESTRICTED:
    "This change cannot be made after check-in.",
  PRICING_QUOTE_FAILED:
    "Unable to calculate the rate summary. Please try again.",
  STAY_FEE_UNAVAILABLE:
    "The selected stay flexibility fee is unavailable. Remove the selection or contact an administrator.",
  CANCELLATION_FAILED:
    "Unable to cancel the reservation. Please try again.",
  UNEXPECTED_FAILURE: "An unexpected error occurred. Please try again.",
};

const UNEXPECTED_OPERATION_MESSAGES = {
  create: "Unable to create the reservation. Please try again.",
  edit: "Unable to save reservation changes. Please try again.",
  quote: "Unable to calculate the rate summary. Please try again.",
  cancel: "Unable to cancel the reservation. Please try again.",
} as const;

export function reservationFailureMessage(code: ReservationFailureCode) {
  return RESERVATION_FAILURE_MESSAGES[code];
}

export function reservationAuthorizationFailure(
  session: { user?: { role?: string } } | null | undefined,
  capability: Capability | readonly string[] = "reservations:write",
): ReservationFailure | null {
  const failure = checkActionAuthorization(session, capability);
  if (!failure) {
    return null;
  }

  return reservationFailure(failure.code as ReservationFailureCode);
}

export function reservationFailure(
  code: ReservationFailureCode,
  options: {
    message?: string;
    field?: ReservationActionField;
  } = {},
): ReservationFailure {
  return {
    ok: false,
    code,
    error: options.message ?? reservationFailureMessage(code),
    ...(options.field ? { field: options.field } : {}),
  };
}

export type ReservationOperation = keyof typeof UNEXPECTED_OPERATION_MESSAGES;

export function unexpectedReservationFailure(
  operation: ReservationOperation,
): ReservationFailure {
  return reservationFailure("UNEXPECTED_FAILURE", {
    message: UNEXPECTED_OPERATION_MESSAGES[operation],
  });
}

export async function safelyRunReservationAction<T>(
  action: () => Promise<T>,
  operation: ReservationOperation,
): Promise<T | ReservationFailure> {
  return safelyRunAction(action, () => unexpectedReservationFailure(operation));
}
