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
  latestCompletedArr: string;
  latestCompletedArrCoverage: string;
};

type TodaySnapshotProps = {
  snapshot: TodaySnapshotData;
};

export function TodaySnapshot({ snapshot }: TodaySnapshotProps) {
  return (
    <section className="space-y-4">
      <h3 className="text-xl font-semibold tracking-tight text-foreground">
        {"Today's Summary"}
      </h3>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard
          label="OCCUPANCY"
          value={formatFixedPercent(snapshot.occupancyPercent)}
          sub="Based on physical rooms"
          className="bg-blue-50/50 border-blue-100 [&_div:first-child]:text-blue-600 [&_div:nth-child(2)]:text-blue-900"
        />
        <KpiCard
          label="OCCUPIED ROOMS"
          value={`${snapshot.roomsOccupied} / ${snapshot.totalRooms}`}
          sub="Occupied rooms / total rooms"
          className="bg-indigo-50/50 border-indigo-100 [&_div:first-child]:text-indigo-600 [&_div:nth-child(2)]:text-indigo-900"
        />
        <KpiCard
          label="TODAY'S CHECK-INS"
          value={snapshot.checkInCount}
          sub="Arrivals on the business date"
          className="bg-emerald-50/50 border-emerald-100 [&_div:first-child]:text-emerald-600 [&_div:nth-child(2)]:text-emerald-900"
        />
        <KpiCard
          label="TODAY'S CHECK-OUTS"
          value={snapshot.checkOutCount}
          sub="Departures on the business date"
          className="bg-orange-50/50 border-orange-100 [&_div:first-child]:text-orange-600 [&_div:nth-child(2)]:text-orange-900"
        />
        <KpiCard
          label="UNAUDITED REVENUE"
          value={formatIDR(snapshot.runningRevenue)}
          sub="Unaudited room + F&B revenue"
          className="bg-emerald-50/50 border-emerald-100 [&_div:first-child]:text-emerald-600 [&_div:nth-child(2)]:text-emerald-900"
        />
        <KpiCard
          label="ARR FOR LAST CLOSED DAY"
          value={snapshot.latestCompletedArr}
          sub={snapshot.latestCompletedArrCoverage}
          className="bg-violet-50/50 border-violet-100 [&_div:first-child]:text-violet-600 [&_div:nth-child(2)]:text-violet-900"
        />
      </div>
    </section>
  );
}
