import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  label: string;
  value: number | string;
  sub: string;
  className?: string;
};

export function KpiCard({ label, value, sub, className }: KpiCardProps) {
  return (
    <Card className={cn("rounded-2xl p-5 gap-2 border border-border", className)}>
      <div className="text-xs font-semibold tracking-tight text-muted-foreground uppercase">
        {label}
      </div>
      <div className="num text-3xl font-bold leading-none mt-1.5 mb-1 text-foreground">
        {value}
      </div>
      <div className="text-xs font-medium text-muted-foreground">{sub}</div>
    </Card>
  );
}
