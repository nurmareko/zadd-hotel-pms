import type { HousekeepingLog } from "@prisma/client";

type HistoryEvent = Pick<HousekeepingLog, "oldStatus" | "newStatus" | "note">;

export function housekeepingLogDescription(log: HistoryEvent): string {
  // Same-status rows are note events regardless of their free-text prefix.
  if (log.oldStatus === log.newStatus) {
    return "Catatan kamar";
  }

  const transition = `${log.oldStatus} → ${log.newStatus}`;

  if (log.oldStatus === "VCU" && log.newStatus === "VC") {
    return `${transition} (lulus inspeksi)`;
  }

  if (log.oldStatus === "VCU" && log.newStatus === "VD") {
    return `${transition} (gagal inspeksi)`;
  }

  if ((log.oldStatus === "OOO" || log.newStatus === "OOO") && log.note) {
    return `${transition} (${log.note})`;
  }

  return transition;
}
