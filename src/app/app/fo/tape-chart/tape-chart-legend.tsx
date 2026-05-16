type TapeChartLegendProps = {
  roomCount: number;
  dayCount: number;
};

const legendItems = [
  {
    code: "VC",
    label: "Vacant Clean",
    bg: "bg-status-vc-bg",
    text: "text-status-vc-fg",
    pip: "bg-status-vc-pip",
  },
  {
    code: "OC",
    label: "Occupied",
    bg: "bg-status-oc-bg",
    text: "text-status-oc-fg",
    pip: "bg-status-oc-pip",
  },
  {
    code: "VD",
    label: "Vacant Dirty",
    bg: "bg-status-vd-bg",
    text: "text-status-vd-fg",
    pip: "bg-status-vd-pip",
  },
  {
    code: "OD",
    label: "Occupied Dirty",
    bg: "bg-status-od-bg",
    text: "text-status-od-fg",
    pip: "bg-status-od-pip",
  },
  {
    code: "VCU",
    label: "Unchecked",
    bg: "bg-status-vcu-bg",
    text: "text-status-vcu-fg",
    pip: "bg-status-vcu-pip",
  },
  {
    code: "OOO",
    label: "Out of Order",
    bg: "bg-status-ooo-bg",
    text: "text-status-ooo-fg",
    pip: "bg-status-ooo-pip",
  },
] as const;

export function TapeChartLegend({
  roomCount,
  dayCount,
}: TapeChartLegendProps) {
  return (
    <div className="mb-3 flex flex-col gap-2 text-[12px] sm:flex-row sm:items-center">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-slate-500">Legenda:</span>
        {legendItems.map((item) => (
          <span
            key={item.code}
            className={[
              "inline-flex h-5 items-center gap-1.5 border border-console-border-soft px-1.5 text-[10px] font-semibold uppercase tracking-[0.06em]",
              item.bg,
              item.text,
            ].join(" ")}
          >
            <span
              className={["h-1.5 w-1.5", item.pip].join(" ")}
              aria-hidden="true"
            />
            {item.code} · {item.label}
          </span>
        ))}
      </div>
      <span className="num text-[11px] text-slate-500 sm:ml-auto">
        {roomCount} kamar · {dayCount} hari
      </span>
    </div>
  );
}
