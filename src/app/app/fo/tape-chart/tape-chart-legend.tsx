import styles from "./tape-chart-grid.module.css";

type TapeChartLegendProps = {
  roomCount: number;
  dayCount: number;
};

const legendItems = [
  {
    code: "VC",
    label: "Vacant Clean",
    bgColor: "#F2F7EC",
    textColor: "#35451F",
    color: "#639922",
    sample: "border-l-[3px]",
  },
  {
    code: "CNF",
    label: "Confirmed",
    bgColor: "#EEF7FF",
    textColor: "#17466F",
    color: "#378ADD",
    sample: "border border-dashed",
  },
  {
    code: "IN",
    label: "Checked In",
    bgColor: "#F2F1FF",
    textColor: "#3D3973",
    color: "#7F77DD",
    sample: "border-l-[3px]",
  },
  {
    code: "VD",
    label: "Vacant Dirty",
    bgColor: "#FFF1EC",
    textColor: "#71321E",
    color: "#D85A30",
    sample: "border-l-[3px]",
  },
  {
    code: "VCU",
    label: "Unchecked",
    bgColor: "#FFF7E8",
    textColor: "#744A0C",
    color: "#EF9F27",
    sample: "border border-dotted",
    pattern: styles.vcuCell,
  },
  {
    code: "OOO",
    label: "Out of Order",
    bgColor: "#F2F2EF",
    textColor: "#42423F",
    color: "#888780",
    sample: "border",
    pattern: styles.outOfOrderCell,
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
            ].join(" ")}
            style={{ backgroundColor: item.bgColor, color: item.textColor }}
          >
            <span
              className={[
                "h-3 w-4",
                item.sample,
                "pattern" in item ? item.pattern : "",
              ].join(" ")}
              style={{
                backgroundColor: item.bgColor,
                borderColor: item.color,
              }}
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
