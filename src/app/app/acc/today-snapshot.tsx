import { formatIDR, formatFixedPercent } from "@/lib/format";

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
    <section className="space-y-4">
      <h3 className="text-xl font-semibold tracking-tight text-foreground">
        Snapshot Hari Ini
      </h3>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="OKUPANSI"
          value={formatFixedPercent(snapshot.occupancyPercent)}
          sub="Berdasarkan physical rooms"
          className="bg-blue-50/50 border-blue-100 [&_div:first-child]:text-blue-600 [&_div:nth-child(2)]:text-blue-900"
        />
        <KpiCard
          label="KAMAR TERISI"
          value={`${snapshot.roomsOccupied} / ${snapshot.totalRooms}`}
          sub="Occupied / total rooms"
          className="bg-indigo-50/50 border-indigo-100 [&_div:first-child]:text-indigo-600 [&_div:nth-child(2)]:text-indigo-900"
        />
        <KpiCard
          label="CHECK-IN HARI INI"
          value={snapshot.checkInCount}
          sub="Arrival pada business date"
          className="bg-emerald-50/50 border-emerald-100 [&_div:first-child]:text-emerald-600 [&_div:nth-child(2)]:text-emerald-900"
        />
        <KpiCard
          label="CHECK-OUT HARI INI"
          value={snapshot.checkOutCount}
          sub="Departure pada business date"
          className="bg-orange-50/50 border-orange-100 [&_div:first-child]:text-orange-600 [&_div:nth-child(2)]:text-orange-900"
        />
        <KpiCard
          label="PENDAPATAN BERJALAN"
          value={formatIDR(snapshot.runningRevenue)}
          sub="Room + F&B belum diaudit"
          className="bg-emerald-50/50 border-emerald-100 [&_div:first-child]:text-emerald-600 [&_div:nth-child(2)]:text-emerald-900"
        />
      </div>
    </section>
  );
}
