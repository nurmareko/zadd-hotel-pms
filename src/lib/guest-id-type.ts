import { GuestIdType } from "@prisma/client";

export const guestIdTypeOptions = [
  { value: GuestIdType.KTP, label: "KTP" },
  { value: GuestIdType.PASSPORT, label: "Paspor" },
  { value: GuestIdType.SIM, label: "SIM" },
  { value: GuestIdType.OTHER, label: "Lainnya" },
] as const;

const guestIdTypeLabels: Record<GuestIdType, string> = Object.fromEntries(
  guestIdTypeOptions.map((option) => [option.value, option.label]),
) as Record<GuestIdType, string>;

export function guestIdTypeLabel(idType: GuestIdType | null | undefined) {
  return idType ? guestIdTypeLabels[idType] : null;
}

export function formatGuestIdentity(
  idType: GuestIdType | null | undefined,
  idNumber: string | null | undefined,
  fallback = "—",
) {
  const typeLabel = guestIdTypeLabel(idType);

  if (typeLabel && idNumber) {
    return `${typeLabel} · ${idNumber}`;
  }

  return typeLabel ?? idNumber ?? fallback;
}
