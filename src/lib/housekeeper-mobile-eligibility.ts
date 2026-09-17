import type { RoomStatus } from "@prisma/client";

export function isMobilePoolEligible({ status, hasScheduledMovement }: {
  status: RoomStatus;
  hasScheduledMovement: boolean;
}): boolean {
  return status !== "OOO" && (
    status === "VD" || status === "OD" || status === "VCU" || hasScheduledMovement
  );
}

export function mobileServiceKind(status: RoomStatus): "turnover" | "stayover" | "inspection" | "routine" {
  switch (status) {
    case "VD": return "turnover";
    case "OD": return "stayover";
    case "VCU": return "inspection";
    default: return "routine";
  }
}
