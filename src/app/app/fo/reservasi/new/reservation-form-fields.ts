import type { ReservationActionField } from "./reservation-errors";

export type ReservationFormTab = "detail" | "inclusions";

const DETAIL_FIELDS = [
  "reservationType",
  "arrivalDate",
  "departureDate",
  "fullName",
  "phone",
  "idType",
  "idNumber",
  "email",
  "nationality",
  "address",
  "notes",
] as const;

const INCLUSION_FIELDS = ["arrangementType", "stayFeeKinds"] as const;
const ROOM_FIELDS = ["roomTypeId", "roomId", "adults", "children"] as const;
const DIRECT_FIELDS = new Set<string>([
  ...DETAIL_FIELDS,
  ...INCLUSION_FIELDS,
  "rooms",
]);
const FLAT_EDIT_ROOM_FIELDS = new Set<string>(ROOM_FIELDS);

export function normalizeReservationFieldPath(
  field: string,
): ReservationActionField | null {
  if (FLAT_EDIT_ROOM_FIELDS.has(field)) {
    return `rooms.0.${field}` as ReservationActionField;
  }

  if (DIRECT_FIELDS.has(field)) {
    return field as ReservationActionField;
  }

  return /^rooms\.\d+\.(roomTypeId|roomId|adults|children)$/.test(field)
    ? (field as ReservationActionField)
    : null;
}

export function reservationFieldTab(field: string): ReservationFormTab | null {
  const normalizedField = normalizeReservationFieldPath(field);

  if (!normalizedField) {
    return null;
  }

  return INCLUSION_FIELDS.includes(
    normalizedField as (typeof INCLUSION_FIELDS)[number],
  )
    ? "inclusions"
    : "detail";
}

function hasErrorAtPath(errors: unknown, path: string) {
  let value = errors;

  for (const segment of path.split(".")) {
    if (typeof value !== "object" || value === null) {
      return false;
    }

    value = (value as Record<string, unknown>)[segment];
  }

  return (
    typeof value === "object" &&
    value !== null &&
    ("message" in value || "type" in value)
  );
}

function roomErrorFields(errors: unknown) {
  if (typeof errors !== "object" || errors === null) {
    return [];
  }

  const rooms = (errors as Record<string, unknown>).rooms;

  if (!Array.isArray(rooms)) {
    return [];
  }

  return rooms.flatMap((_, index) =>
    ROOM_FIELDS.map((field) => `rooms.${index}.${field}`),
  );
}

export function firstReservationErrorField(
  errors: unknown,
): ReservationActionField | null {
  const orderedFields = [
    ...DETAIL_FIELDS,
    "rooms",
    ...roomErrorFields(errors),
    ...INCLUSION_FIELDS,
  ];
  const field = orderedFields.find((candidate) => hasErrorAtPath(errors, candidate));

  return field ? normalizeReservationFieldPath(field) : null;
}

export function firstReservationErrorTab(
  errors: unknown,
): ReservationFormTab | null {
  const field = firstReservationErrorField(errors);

  return field ? reservationFieldTab(field) : null;
}
