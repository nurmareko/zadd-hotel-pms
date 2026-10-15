"use client";

import type { ArrangementType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatIDR } from "@/lib/format";
import { updateMealPlanPrices } from "./actions";

const plans = [
  { code: "BB", name: "Breakfast" },
  { code: "HB", name: "Breakfast + one main meal" },
  { code: "FB", name: "Breakfast, lunch and dinner" },
] as const;

export function MealPlanForm({ prices, canManage }: {
  prices: Record<ArrangementType, number>;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canManage || pending) return;
        const data = new FormData(event.currentTarget);
        setError(null);
        startTransition(async () => {
          try {
            const result = await updateMealPlanPrices(Object.fromEntries(data));
            if (!result.ok) { setError(result.error); return; }
            toast.success("Meal plan prices saved.");
            router.refresh();
          } catch {
            setError("Unable to save prices. Check your connection and try again.");
          }
        });
      }}
    >
      <div className="border-b border-slate-200 p-4 md:p-5">
        <h2 className="text-base font-semibold">Current meal plan prices</h2>
        <p id="meal-price-help" className="mt-1 text-sm text-muted-foreground">
          Applies to new reservations and meal plan changes for future nights that have not been posted. Guest count changes continue to use the saved prices.
        </p>
      </div>
      <div className="divide-y divide-slate-100">
        <div className="flex flex-wrap justify-between gap-3 p-4 md:p-5">
          <p><span className="font-semibold">RO</span> — Room only</p>
          <p className="text-sm text-muted-foreground">{formatIDR(0)} · Fixed</p>
        </div>
        {plans.map((plan) => (
          <div key={plan.code} className="grid items-center gap-3 p-4 sm:grid-cols-2 md:p-5">
            <label htmlFor={`price-${plan.code}`} className="text-sm">
              <span className="font-semibold">{plan.code}</span> — {plan.name}
              <span className="mt-1 block text-xs text-muted-foreground">IDR per guest per night</span>
            </label>
            {canManage ? (
              <Input id={`price-${plan.code}`} name={plan.code} type="number" inputMode="numeric"
                min={0} max={9_999_999_999} step={1} required defaultValue={prices[plan.code]}
                disabled={pending} aria-describedby="meal-price-help" className="h-11 sm:ml-auto sm:max-w-xs" />
            ) : <p className="font-medium tabular-nums sm:text-right">{formatIDR(prices[plan.code])}</p>}
          </div>
        ))}
      </div>
      <div className="space-y-3 border-t border-slate-200 p-4 md:p-5">
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        {canManage ? <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save Prices"}</Button>
          : <p className="text-sm text-muted-foreground">Only ADMIN and GM can change meal plan prices.</p>}
      </div>
    </form>
  );
}
