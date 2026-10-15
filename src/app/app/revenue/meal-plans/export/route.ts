import type { ArrangementType } from "@prisma/client";

import { auth } from "@/auth";
import { getMealPlanPrices, MEAL_PLAN_DEFINITIONS } from "@/lib/arrangement-inclusions";
import { createCsvResponse, generateCsv, type CsvColumn } from "@/lib/csv";
import { todayDateOnly } from "@/lib/date-only";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const plans = [
  { code: "RO", name: "Room only" },
  { code: "BB", name: "Breakfast" },
  { code: "HB", name: "Breakfast + one main meal" },
  { code: "FB", name: "Breakfast, lunch and dinner" },
] as const satisfies readonly { code: ArrangementType; name: string }[];

type MealPlanRow = { code: ArrangementType; name: string; price: number };

const columns: CsvColumn<MealPlanRow>[] = [
  { header: "Plan Code", accessor: (row) => row.code },
  { header: "Plan Name", accessor: (row) => row.name },
  { header: "Article Code", accessor: (row) => MEAL_PLAN_DEFINITIONS[row.code]?.articleCode ?? "-" },
  { header: "Price (IDR/Guest/Night)", accessor: (row) => row.price },
  { header: "Notes", accessor: (row) => row.code === "RO" ? "Fixed" : "Configurable" },
];

export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Please sign in first.", { status: 401 });
  if (!can(session.user.role, "revenue:read")) {
    return new Response("You do not have permission to export revenue data.", { status: 403 });
  }

  const prices = await getMealPlanPrices(prisma);
  const rows = plans.map((plan) => ({ ...plan, price: prices[plan.code] }));
  const date = todayDateOnly().today.toISOString().slice(0, 10);
  return createCsvResponse(generateCsv(columns, rows), `meal-plans-${date}.csv`);
}
