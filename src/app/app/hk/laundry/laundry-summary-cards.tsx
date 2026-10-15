import { Archive, CircleAlert, Clock3, WashingMachine } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { LaundrySummaryData } from "@/lib/laundry/data";

const cards = [
  { key: "cleanCount", label: "Clean and Ready", description: "Total clean linen received into stock.", icon: Archive, color: "bg-emerald-50 text-emerald-700" },
  { key: "washingCount", label: "Being Washed", description: "Linen currently being washed.", icon: WashingMachine, color: "bg-blue-50 text-blue-700" },
  { key: "sentCount", label: "Awaiting Wash", description: "Linen sent and awaiting washing.", icon: Clock3, color: "bg-amber-50 text-amber-700" },
  { key: "damagedCount", label: "Discarded / Damaged", description: "Total damaged linen recorded on receipt, excluding missing items.", icon: CircleAlert, color: "bg-rose-50 text-rose-700" },
] as const;

export function LaundrySummaryCards({ summary }: { summary: LaundrySummaryData }) {
  return (
    <section aria-label="Linen summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 md:gap-4">
      {cards.map(({ key, label, description, icon: Icon, color }) => (
        <Card key={key} className="gap-3 p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">{label}</h2>
            <span className={`rounded-md p-2 ${color}`}><Icon className="size-5" aria-hidden="true" /></span>
          </div>
          <p className="num text-3xl font-bold">{summary[key].toLocaleString("id-ID")} <span className="text-sm font-normal text-muted-foreground">unit</span></p>
          <p className="text-xs leading-5 text-muted-foreground">{description}</p>
        </Card>
      ))}
    </section>
  );
}
