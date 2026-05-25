import styles from "./tape-chart-grid.module.css";

type TapeChartLegendProps = {
  roomCount: number;
  dayCount: number;
};

const legendItems = [
  {
    code: "VC",
    label: "Vacant Clean",
    bgColor: "#639922",
    textColor: "#FFFFFF",
    cueColor: "rgb(255 255 255 / 0.82)",
    sample: "border-l-[3px]",
  },
  {
    code: "CNF",
    label: "Confirmed",
    bgColor: "#378ADD",
    textColor: "#FFFFFF",
    cueColor: "rgb(255 255 255 / 0.82)",
    sample: "border border-dashed",
  },
  {
    code: "IN",
    label: "Checked In",
    bgColor: "#7F77DD",
    textColor: "#FFFFFF",
    cueColor: "rgb(255 255 255 / 0.82)",
    sample: "border-l-[3px]",
  },
  {
    code: "VD",
    label: "Vacant Dirty",
    bgColor: "#D85A30",
    textColor: "#FFFFFF",
    cueColor: "rgb(255 255 255 / 0.82)",
    sample: "border-l-[3px]",
  },
  {
    code: "VCU",
    label: "Unchecked",
    bgColor: "#EF9F27",
    textColor: "#412402",
    cueColor: "rgb(65 36 2 / 0.58)",
    sample: "border border-dotted",
    pattern: styles.vcuCell,
  },
  {
    code: "OOO",
    label: "Out of Order",
    bgColor: "#888780",
    textColor: "#FFFFFF",
    cueColor: "rgb(255 255 255 / 0.78)",
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
            style={{
              backgroundColor: item.bgColor,
              color: item.textColor,
              textShadow:
                item.textColor === "#FFFFFF"
                  ? "0 1px 1px rgb(0 0 0 / 0.35)"
                  : "none",
            }}
          >
            <span
              className={[
                "h-3 w-4",
                item.sample,
                "pattern" in item ? item.pattern : "",
              ].join(" ")}
              style={{
                backgroundColor: item.bgColor,
                borderColor: item.cueColor,
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
