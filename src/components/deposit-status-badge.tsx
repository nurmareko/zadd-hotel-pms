import { DepositStatus } from "@prisma/client";

import { StatusBadge } from "@/components/status-badge";

const depositStatusClassNames: Record<DepositStatus, string> = {
  [DepositStatus.PENDING]:
    "bg-status-vd-bg text-status-vd-fg border-status-vd-pip",
  [DepositStatus.COLLECTED]:
    "bg-status-vc-bg text-status-vc-fg border-status-vc-pip",
};

const depositStatusLabels: Record<DepositStatus, string> = {
  [DepositStatus.PENDING]: "Pending",
  [DepositStatus.COLLECTED]: "Collected",
};

export function DepositStatusBadge({ status }: { status: DepositStatus }) {
  return (
    <StatusBadge
      label={depositStatusLabels[status]}
      className={depositStatusClassNames[status]}
    />
  );
}
