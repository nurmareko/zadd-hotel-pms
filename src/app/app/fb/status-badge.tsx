import { FBOrderStatus, TableStatus } from "@prisma/client";

const tableStatusStyles: Record<TableStatus, string> = {
  AVAILABLE: "border-status-vc-pip bg-status-vc-bg text-status-vc-fg",
  OCCUPIED: "border-status-oc-pip bg-status-oc-bg text-status-oc-fg",
  RESERVED: "border-status-vcu-pip bg-status-vcu-bg text-status-vcu-fg",
  OUT_OF_SERVICE: "border-status-ooo-pip bg-status-ooo-bg text-status-ooo-fg",
};

const orderStatusStyles: Record<FBOrderStatus, string> = {
  OPEN: "border-status-vd-pip bg-status-vd-bg text-status-vd-fg",
  BILLED: "border-status-oc-pip bg-status-oc-bg text-status-oc-fg",
  CLOSED: "border-status-vc-pip bg-status-vc-bg text-status-vc-fg",
  VOIDED: "border-status-od-pip bg-status-od-bg text-status-od-fg",
};

const tableStatusLabels: Record<TableStatus, string> = {
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

export function TableStatusBadge({ status }: { status: TableStatus }) {
  return <StatusBadge className={tableStatusStyles[status]} label={tableStatusLabels[status]} />;
}

export function OrderStatusBadge({ status }: { status: FBOrderStatus }) {
  return <StatusBadge className={orderStatusStyles[status]} label={orderStatusLabels[status]} />;
}

function StatusBadge({ className, label }: { className: string; label: string }) {
  return (
    <span
      className={`inline-flex h-5 items-center gap-1.5 border px-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${className}`}
    >
      <span className="h-1.5 w-1.5 bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}
