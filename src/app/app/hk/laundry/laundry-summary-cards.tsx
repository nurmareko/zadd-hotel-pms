import { Archive, CircleAlert, Clock3, WashingMachine } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { LaundrySummaryData } from "@/lib/laundry/data";

const cards = [
  { key: "cleanCount", label: "Bersih Siap Pakai", description: "Total linen bersih yang telah diterima dan masuk gudang.", icon: Archive, color: "bg-emerald-50 text-emerald-700" },
  { key: "washingCount", label: "Sedang Dicuci", description: "Linen yang sedang dalam proses pencucian.", icon: WashingMachine, color: "bg-blue-50 text-blue-700" },
  { key: "sentCount", label: "Menunggu Cuci", description: "Linen yang sudah dikirim dan menunggu proses pencucian.", icon: Clock3, color: "bg-amber-50 text-amber-700" },
  { key: "damagedCount", label: "Afkir / Rusak", description: "Total linen rusak yang dicatat saat penerimaan, tidak termasuk kehilangan.", icon: CircleAlert, color: "bg-rose-50 text-rose-700" },
] as const;

export function LaundrySummaryCards({ summary }: { summary: LaundrySummaryData }) {
  return (
    <section aria-label="Ringkasan linen" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 md:gap-4">
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
