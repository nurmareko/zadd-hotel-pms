import { FBOrderStatus, TableStatus } from "@prisma/client";

import { StatusBadge } from "@/components/status-badge";



const orderStatusStyles: Record<FBOrderStatus, string> = {
  OPEN: "border-status-vd-pip bg-status-vd-bg text-status-vd-fg",
  BILLED: "border-status-oc-pip bg-status-oc-bg text-status-oc-fg",
  CLOSED: "border-status-vc-pip bg-status-vc-bg text-status-vc-fg",
  VOIDED: "border-status-od-pip bg-status-od-bg text-status-od-fg",
};

export const tableStatusLabels: Record<TableStatus, string> = {
  AVAILABLE: "Available",
  OCCUPIED: "Occupied",
  RESERVED: "Reserved",
  OUT_OF_SERVICE: "OOS",
};

const orderStatusLabels: Record<FBOrderStatus, string> = {
  OPEN: "Open",
  BILLED: "Billed",
  CLOSED: "Closed",
  VOIDED: "Voided",
};



export function OrderStatusBadge({ status }: { status: FBOrderStatus }) {
  return (
    <StatusBadge
      className={orderStatusStyles[status]}
      label={orderStatusLabels[status]}
    />
  );
}
