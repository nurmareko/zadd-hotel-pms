import { formatIDR } from "@/lib/format";

import { KpiCard } from "./kpi-card";

export type TodaySnapshotData = {
  occupancyPercent: number;
  roomsOccupied: number;
  totalRooms: number;
  inHouseCount: number;
  checkInCount: number;
  checkOutCount: number;
  runningRevenue: number;
};

type TodaySnapshotProps = {
  snapshot: TodaySnapshotData;
};

export function TodaySnapshot({ snapshot }: TodaySnapshotProps) {
  return (
    <section>
      <div className="mb-2 border border-console-border bg-console-ink px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
        {"// HARI INI"}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="OKUPANSI"
          value={`${snapshot.occupancyPercent}%`}
          sub={`${snapshot.roomsOccupied} / ${snapshot.totalRooms} kamar terisi`}
        />
        <KpiCard
          label="TAMU IN-HOUSE"
          value={snapshot.inHouseCount}
          sub="Reservasi status CHECKED_IN"
        />
        <KpiCard
          label="CHECK-IN HARI INI"
          value={snapshot.checkInCount}
          sub="Arrival business date ini"
        />
        <KpiCard
          label="CHECK-OUT HARI INI"
          value={snapshot.checkOutCount}
          sub="Departure business date ini"
        />
        <KpiCard
          label="PENDAPATAN BERJALAN"
          value={formatIDR(snapshot.runningRevenue)}
          sub="Folio hari ini + F&B closed"
        />
      </div>
    </section>
  );
}
