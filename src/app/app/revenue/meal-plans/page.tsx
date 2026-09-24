import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getMealPlanPrices } from "@/lib/arrangement-inclusions";
import { can } from "@/lib/permissions";
import { MealPlanForm } from "./meal-plan-form";

export const dynamic = "force-dynamic";

export default async function MealPlansPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "revenue:read")) redirect("/app/forbidden");
  const prices = await getMealPlanPrices();

  return (
    <main className="min-h-screen space-y-6 bg-slate-50 px-4 py-4 text-foreground md:px-6 md:py-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Paket Makan</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Harga per tamu per malam. Perubahan harga tidak mengubah Inklusi yang sudah tersimpan.
        </p>
      </header>
      <MealPlanForm key={JSON.stringify(prices)} prices={prices} canManage={can(session.user.role, "pricing_rules:manage")} />
    </main>
  );
}
