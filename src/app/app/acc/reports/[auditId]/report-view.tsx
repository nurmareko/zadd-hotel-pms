import {
  formatCompactDateTimeID,
  formatFixedPercent,
  formatIDR,
  formatLongDateID,
} from "@/lib/format";

type StringableDecimal = {
  toString(): string;
};

export type NightReportSnapshot = {
  id: number;
  businessDate: Date;
  runAt: Date;
  totalRooms: number;
  roomsOccupied: number;
  occupancyRate: StringableDecimal;
  roomRevenue: StringableDecimal;
  fbRevenue: StringableDecimal;
  otherRevenue: StringableDecimal;
  totalRevenue: StringableDecimal;
  checkInCount: number;
  checkOutCount: number;
  inHouseCount: number;
  runBy: {
    fullName: string;
  };
};

type ReportViewProps = {
  audit: NightReportSnapshot;
  settings: {
    hotelName: string;
    address: string | null;
  };
};

function dateLabel(date: Date) {
  return formatLongDateID(date);
}

function dateTimeLabel(date: Date) {
  return formatCompactDateTimeID(date);
}

function percentLabel(value: StringableDecimal) {
  return formatFixedPercent(value.toString());
}

function SnapshotRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={
        strong
          ? "flex items-center justify-between gap-3 bg-console-ink px-3 py-2 text-console-accent"
          : "flex items-center justify-between gap-3 border-b border-console-border-soft px-3 py-2"
      }
    >
      <span
        className={
          strong
            ? "text-[11px] font-bold uppercase tracking-[0.08em]"
            : "text-slate-500"
        }
      >
        {label}
      </span>
      <span
        className={
          strong
            ? "num text-[16px] font-bold"
            : "num font-semibold text-console-ink"
        }
      >
        {value}
      </span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <div className="border border-console-border bg-white p-3">
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.10em] text-slate-600">
        {`[ ${label} ]`}
      </div>
      <div className="num mt-2 text-[22px] font-bold leading-tight text-console-ink">
        {value}
      </div>
      <div className="mt-1 text-[11px] text-slate-500">{sub}</div>
    </div>
  );
}

export function ReportView({ audit, settings }: ReportViewProps) {
  return (
    <section className="border border-console-border bg-console-surface">
      <div className="border-b border-console-border bg-console-ink px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
        {"// LAPORAN"}
      </div>

      <div className="grid gap-4 p-3.5">
        <div className="grid gap-3 border border-console-border bg-console-bg p-3 text-[12px] md:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-600">
              Hotel
            </div>
            <div className="mt-1 text-[15px] font-bold uppercase tracking-[0.04em] text-console-ink">
              {settings.hotelName}
            </div>
            <div className="mt-1 text-[12px] text-slate-500">
              {settings.address ?? "-"}
            </div>
          </div>
          <div className="space-y-1 text-[12px]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Audit ID</span>
              <span className="num font-semibold">#{audit.id}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Business date</span>
              <span className="num font-semibold">
                {dateLabel(audit.businessDate)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Run at</span>
              <span className="num font-semibold">
                {dateTimeLabel(audit.runAt)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Run by</span>
              <span className="font-semibold">{audit.runBy.fullName}</span>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-ink">
            {"// OKUPANSI"}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <MetricCard
              label="Okupansi"
              value={percentLabel(audit.occupancyRate)}
              sub="Snapshot occupancy rate"
            />
            <MetricCard
              label="Kamar Terisi"
              value={`${audit.roomsOccupied} / ${audit.totalRooms}`}
              sub="Rooms occupied / total rooms"
            />
          </div>
        </div>

        <div>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-ink">
            {"// MOVEMENT"}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard
              label="Check-in"
              value={audit.checkInCount}
              sub="Arrival pada business date"
            />
            <MetricCard
              label="Check-out"
              value={audit.checkOutCount}
              sub="Departure pada business date"
            />
            <MetricCard
              label="In-house"
              value={audit.inHouseCount}
              sub="Tamu menginap saat audit"
            />
          </div>
        </div>

        <div>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-ink">
            {"// REVENUE BREAKDOWN"}
          </div>
          <div className="border border-console-border bg-white text-[12px]">
            <SnapshotRow
              label="Pendapatan Kamar"
              value={formatIDR(audit.roomRevenue.toString())}
            />
            <SnapshotRow
              label="Pendapatan F&B"
              value={formatIDR(audit.fbRevenue.toString())}
            />
            <SnapshotRow
              label="Pendapatan Lain"
              value={formatIDR(audit.otherRevenue.toString())}
            />
            <SnapshotRow
              label="Total Pendapatan"
              value={formatIDR(audit.totalRevenue.toString())}
              strong
            />
          </div>
        </div>
      </div>
    </section>
  );
}
