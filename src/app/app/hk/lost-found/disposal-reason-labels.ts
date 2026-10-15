export const DISPOSAL_REASON_LABELS = {
  "Masa simpan berakhir": "Retention period expired",
  "Dihibahkan ke yayasan": "Donated to charity",
  "Dimusnahkan karena rusak/kedaluwarsa": "Disposed of due to damage / expiry",
} as const;

export function disposalReasonLabel(reason: string | null): string | null {
  if (reason === null) return null;

  for (const [value, label] of Object.entries(DISPOSAL_REASON_LABELS)) {
    if (reason === value) return label;
    // Only recognise the current and legacy operation delimiters, not arbitrary prose.
    for (const delimiter of ["\nNotes: ", "\nCatatan: "]) {
      const prefix = value + delimiter;
      if (reason.startsWith(prefix)) {
        return `${label}\nNotes: ${reason.slice(prefix.length)}`;
      }
    }
  }
  return reason;
}
