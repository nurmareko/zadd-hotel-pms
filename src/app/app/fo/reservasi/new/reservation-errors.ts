import { unstable_rethrow } from "next/navigation";

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
  SESSION_EXPIRED: "Sesi Anda telah berakhir. Silakan masuk kembali.",
  FORBIDDEN: "Anda tidak memiliki izin untuk melakukan tindakan ini.",
  INVALID_RESERVATION_DATA:
    "Data reservasi tidak valid. Periksa kembali formulir.",
  RESERVATION_NOT_FOUND:
    "Reservasi tidak ditemukan. Muat ulang halaman atau kembali ke daftar reservasi.",
  RESERVATION_CONFLICT:
    "Reservasi berubah sejak halaman ini dibuka. Muat ulang data lalu coba lagi.",
  ROOM_UNAVAILABLE:
    "Kamar yang dipilih sudah tidak tersedia untuk tanggal tersebut. Pilih kamar lain.",
  INVALID_ROOM_TYPE: "Tipe kamar yang dipilih tidak valid.",
  INVALID_ROOM: "Kamar yang dipilih tidak valid.",
  ROOM_OOO:
    "Kamar yang dipilih sedang berstatus OOO dan tidak dapat dipesan.",
  POST_CHECK_IN_EDIT_RESTRICTED:
    "Perubahan ini tidak dapat dilakukan setelah check-in.",
  PRICING_QUOTE_FAILED:
    "Ringkasan harga tidak dapat dihitung. Silakan coba lagi.",
  STAY_FEE_UNAVAILABLE:
    "Biaya fleksibilitas yang dipilih sedang tidak tersedia. Hapus pilihan atau hubungi admin.",
  CANCELLATION_FAILED:
    "Reservasi tidak dapat dibatalkan. Silakan coba lagi.",
  UNEXPECTED_FAILURE: "Terjadi kegagalan yang tidak terduga. Silakan coba lagi.",
};

const UNEXPECTED_OPERATION_MESSAGES = {
  create: "Reservasi tidak dapat dibuat. Silakan coba lagi.",
  edit: "Perubahan reservasi tidak dapat disimpan. Silakan coba lagi.",
  quote: "Ringkasan harga tidak dapat dihitung. Silakan coba lagi.",
  cancel: "Reservasi tidak dapat dibatalkan. Silakan coba lagi.",
} as const;

export function reservationFailureMessage(code: ReservationFailureCode) {
  return RESERVATION_FAILURE_MESSAGES[code];
}

export function reservationAuthorizationFailure(
  session: { user?: { role?: string } } | null | undefined,
  allowedRoles: readonly string[],
): ReservationFailure | null {
  if (!session?.user) {
    return reservationFailure("SESSION_EXPIRED");
  }

  return session.user.role && allowedRoles.includes(session.user.role)
    ? null
    : reservationFailure("FORBIDDEN");
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
  try {
    return await action();
  } catch (error) {
    unstable_rethrow(error);
    return unexpectedReservationFailure(operation);
  }
}
