import Link from "next/link";
import type { RoomStatus } from "@prisma/client";

export type RoomStatusGridRoom = {
  id: number;
  number: string;
  status: RoomStatus;
  lastActivityLabel: string;
  href: string;
};

export type RoomStatusGridFloor = {
  floor: number;
  rooms: RoomStatusGridRoom[];
};

const statusClassNames: Record<
  RoomStatus,
  { badge: string; pip: string; card: string }
> = {
  VC: {
    badge: "border-status-vc-pip bg-status-vc-bg text-status-vc-fg",
    pip: "bg-status-vc-pip",
    card: "hover:border-status-vc-pip hover:bg-status-vc-bg",
  },
  OC: {
    badge: "border-status-oc-pip bg-status-oc-bg text-status-oc-fg",
    pip: "bg-status-oc-pip",
    card: "hover:border-status-oc-pip hover:bg-status-oc-bg",
  },
  VD: {
    badge: "border-status-vd-pip bg-status-vd-bg text-status-vd-fg",
    pip: "bg-status-vd-pip",
    card: "hover:border-status-vd-pip hover:bg-status-vd-bg",
  },
  OD: {
    badge: "border-status-od-pip bg-status-od-bg text-status-od-fg",
    pip: "bg-status-od-pip",
    card: "hover:border-status-od-pip hover:bg-status-od-bg",
  },
  VCU: {
    badge: "border-status-vcu-pip bg-status-vcu-bg text-status-vcu-fg",
    pip: "bg-status-vcu-pip",
    card: "hover:border-status-vcu-pip hover:bg-status-vcu-bg",
  },
  OOO: {
    badge: "border-status-ooo-pip bg-status-ooo-bg text-status-ooo-fg",
    pip: "bg-status-ooo-pip",
    card: "hover:border-status-ooo-pip hover:bg-status-ooo-bg",
  },
};

export function StatusPill({ status }: { status: RoomStatus }) {
  const classes = statusClassNames[status];

  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 border px-2 text-[10px] font-semibold uppercase tracking-[0.06em] ${classes.badge}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 ${classes.pip}`} />
      {status}
    </span>
  );
}

export function RoomStatusGrid({ floors }: { floors: RoomStatusGridFloor[] }) {
  return (
    <div className="space-y-4">
      {floors.map((floor) => (
        <section key={floor.floor}>
          <h2 className="border-b border-console-border bg-console-bg px-1 pb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-600">
            Lantai {floor.floor}
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8">
            {floor.rooms.map((room) => {
              const classes = statusClassNames[room.status];

              return (
                <Link
                  key={room.id}
                  href={room.href}
                  className={`min-h-[92px] border border-console-border bg-console-surface p-2.5 transition-colors ${classes.card}`}
                >
                  <div className="num text-[18px] font-bold leading-none text-console-ink">
                    {room.number}
                  </div>
                  <div className="mt-2">
                    <StatusPill status={room.status} />
                  </div>
                  <div className="mt-2 text-[10px] leading-snug text-slate-500">
                    {room.lastActivityLabel}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
