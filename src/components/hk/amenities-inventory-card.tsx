import { AlertTriangle, Package } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { AmenitiesStockSummary } from "@/lib/housekeeping/amenities-stock";

const stockStatuses = {
  OK: { label: "OK", className: "bg-green-100 text-green-800" },
  LOW: { label: "Low Stock", className: "bg-amber-100 text-amber-800" },
  OUT: { label: "Out of Stock", className: "bg-orange-100 text-orange-800" },
  NEGATIVE: { label: "Negative", className: "bg-red-100 text-red-700" },
};
const quantityFormat = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 3,
});

export function AmenitiesInventoryCard({
  items,
  lowStockCount,
}: AmenitiesStockSummary) {
  return (
    <Card className="mt-4 gap-0 rounded-lg p-0 shadow-sm md:mt-6">
      <CardHeader className="border-b border-border p-4 md:px-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Package className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Amenities Inventory
        </h2>
        <p className="text-sm text-muted-foreground">
          Current stock on hand and par levels, regardless of the selected board date.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {lowStockCount > 0 && (
          <div role="status" className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 md:px-5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              <span className="font-semibold">Low stock: {lowStockCount} {lowStockCount === 1 ? "item needs" : "items need"} attention.</span>{" "}
              Review replenishment for low or depleted stock and reconcile negative balances.
            </p>
          </div>
        )}
        {items.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground md:p-5">
            No amenities inventory items are configured. Contact an administrator to set up stock records.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => {
              const status = stockStatuses[item.status];
              return (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-5">
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="break-words text-sm font-semibold">{item.name}</p>
                    <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <div className="flex flex-wrap gap-x-1">
                        <dt className="text-muted-foreground">On Hand:</dt>
                        <dd className="tabular-nums">{quantityFormat.format(item.onHand)} {item.unit}</dd>
                      </div>
                      <div className="flex flex-wrap gap-x-1">
                        <dt className="text-muted-foreground">Par:</dt>
                        <dd className="tabular-nums">{quantityFormat.format(item.parLevel)} {item.unit}</dd>
                      </div>
                    </dl>
                  </div>
                  <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>
                    {status.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
