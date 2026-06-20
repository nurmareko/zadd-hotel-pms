import {
  formatCompactDateTimeID,
  formatFixedPercent,
  formatIDR,
  formatLongDateID,
} from "@/lib/format";
import { cn } from "@/lib/utils";

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
          ? "flex items-center justify-between gap-3 bg-muted px-4 py-3 text-foreground"
          : "flex items-center justify-between gap-3 border-b border-border px-4 py-3"
      }
    >
      <span
        className={
          strong
            ? "text-xs font-bold uppercase tracking-[0.08em]"
            : "text-muted-foreground"
        }
      >
        {label}
      </span>
      <span
        className={
          strong
            ? "num text-base font-bold text-foreground"
            : "num font-semibold text-foreground"
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
  className,
  labelClassName,
  valueClassName,
  subClassName,
}: {
  label: string;
  value: string | number;
  sub: string;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
  subClassName?: string;
}) {
  return (
    <div className={cn("border bg-card rounded-2xl p-5", className || "border-border")}>
      <div className={cn("text-xs font-semibold uppercase tracking-tight", labelClassName || "text-muted-foreground")}>
        {label}
      </div>
      <div className={cn("num mt-1.5 text-3xl font-bold leading-none", valueClassName || "text-foreground")}>
        {value}
      </div>
      <div className={cn("mt-1 text-xs", subClassName || "text-muted-foreground")}>{sub}</div>
    </div>
  );
}

export function ReportView({ audit, settings }: ReportViewProps) {
  return (
    <section className="border border-border bg-card rounded-2xl">
      <div className="border-b border-border px-5 py-4 text-base font-semibold tracking-tight text-foreground rounded-t-2xl">
        {"LAPORAN"}
      </div>

      <div className="grid gap-6 p-5">
        <div className="grid gap-4 border border-border bg-slate-50 rounded-xl p-5 text-sm md:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
              Hotel
            </div>
            <div className="mt-1 text-[15px] font-bold uppercase tracking-[0.04em] text-foreground">
              {settings.hotelName}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {settings.address ?? "-"}
            </div>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Audit ID</span>
              <span className="num font-semibold">#{audit.id}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Business date</span>
              <span className="num font-semibold">
                {dateLabel(audit.businessDate)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Dijalankan</span>
              <span className="num font-semibold">
                {dateTimeLabel(audit.runAt)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Oleh</span>
              <span className="font-semibold">{audit.runBy.fullName}</span>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-foreground">
            {"OKUPANSI"}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <MetricCard
              label="Okupansi"
              value={percentLabel(audit.occupancyRate)}
              sub="Snapshot occupancy rate"
              className="bg-blue-50/50 border-blue-100"
              labelClassName="text-blue-600"
              valueClassName="text-blue-900"
              subClassName="text-blue-700/80"
            />
            <MetricCard
              label="Kamar Terisi"
              value={`${audit.roomsOccupied} / ${audit.totalRooms}`}
              sub="Rooms occupied / total rooms"
              className="bg-indigo-50/50 border-indigo-100"
              labelClassName="text-indigo-600"
              valueClassName="text-indigo-900"
              subClassName="text-indigo-700/80"
            />
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-foreground">
            {"MOVEMENT"}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard
              label="Check-in"
              value={audit.checkInCount}
              sub="Arrival pada business date"
              className="bg-emerald-50/50 border-emerald-100"
              labelClassName="text-emerald-600"
              valueClassName="text-emerald-900"
              subClassName="text-emerald-700/80"
            />
            <MetricCard
              label="Check-out"
              value={audit.checkOutCount}
              sub="Departure pada business date"
              className="bg-orange-50/50 border-orange-100"
              labelClassName="text-orange-600"
              valueClassName="text-orange-900"
              subClassName="text-orange-700/80"
            />
            <MetricCard
              label="In-house"
              value={audit.inHouseCount}
              sub="Tamu menginap saat audit"
              className="bg-purple-50/50 border-purple-100"
              labelClassName="text-purple-600"
              valueClassName="text-purple-900"
              subClassName="text-purple-700/80"
            />
          </div>
        </div>

        <div>
          <div className="mb-3 text-sm font-semibold tracking-tight text-foreground">
            Revenue Breakdown
          </div>
          <div className="border border-border rounded-xl bg-card text-sm overflow-hidden">
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
