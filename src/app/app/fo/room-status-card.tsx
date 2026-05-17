import type { RoomStatus } from "@prisma/client";

export type RoomStatusSummaryRow = {
  status: RoomStatus;
  label: string;
  count: number;
};

const statusClassNames: Record<
  RoomStatus,
  { badge: string; pip: string }
> = {
  VC: {
    badge: "border-status-vc-pip bg-status-vc-bg text-status-vc-fg",
    pip: "bg-status-vc-pip",
  },
  OC: {
    badge: "border-status-oc-pip bg-status-oc-bg text-status-oc-fg",
    pip: "bg-status-oc-pip",
  },
  VD: {
    badge: "border-status-vd-pip bg-status-vd-bg text-status-vd-fg",
    pip: "bg-status-vd-pip",
  },
  OD: {
    badge: "border-status-od-pip bg-status-od-bg text-status-od-fg",
    pip: "bg-status-od-pip",
  },
  VCU: {
    badge: "border-status-vcu-pip bg-status-vcu-bg text-status-vcu-fg",
    pip: "bg-status-vcu-pip",
  },
  OOO: {
    badge: "border-status-ooo-pip bg-status-ooo-bg text-status-ooo-fg",
    pip: "bg-status-ooo-pip",
  },
};

function StatusBadge({ status }: { status: RoomStatus }) {
  const classes = statusClassNames[status];

  return (
    <span
      className={`inline-flex h-5 items-center gap-1.5 border px-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${classes.badge}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 ${classes.pip}`} />
      {status}
    </span>
  );
}

export function RoomStatusCard({ rows }: { rows: RoomStatusSummaryRow[] }) {
  return (
    <section className="border border-console-border bg-console-surface">
      <div className="border-b border-console-border bg-console-surface px-3.5 py-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-console-ink">
          Status Kamar
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-2 p-3.5 sm:grid-cols-3">
        {rows.map((row) => (
          <div
            key={row.status}
            className="border border-slate-200 px-1.5 py-2.5 text-center"
          >
            <div className="num text-[20px] font-semibold text-console-ink">
              {row.count}
            </div>
            <div className="mt-1 flex justify-center">
              <StatusBadge status={row.status} />
            </div>
            <div className="mt-1 truncate text-[9px] text-slate-500">
              {row.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
