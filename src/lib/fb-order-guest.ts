const GUEST_NOTE_PATTERN = /^@@guest:(\d{1,2})@@(?:\s*)([\s\S]*)$/;

export type ParsedFBOrderItemNotes = {
  guestNumber: number | null;
  notes: string;
};

export function parseFBOrderItemNotes(
  value: string | null | undefined,
): ParsedFBOrderItemNotes {
  const notes = value ?? "";
  const match = notes.match(GUEST_NOTE_PATTERN);

  if (!match) {
    return { guestNumber: null, notes };
  }

  return {
    guestNumber: Number(match[1]),
    notes: match[2]?.trimStart() ?? "",
  };
}

export function formatFBOrderItemNotes(
  guestNumber: number | null | undefined,
  notes: string | null | undefined,
) {
  const cleanedNotes = notes?.trim() ?? "";

  if (!guestNumber) {
    return cleanedNotes || null;
  }

  return `@@guest:${guestNumber}@@${cleanedNotes ? ` ${cleanedNotes}` : ""}`;
}

export function fbOrderGuestLabel(guestNumber: number | null | undefined) {
  return guestNumber ? `Tamu ${guestNumber}` : "Tanpa Tamu";
}
