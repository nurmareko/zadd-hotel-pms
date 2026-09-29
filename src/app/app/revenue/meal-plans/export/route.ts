import type { ArrangementType } from "@prisma/client";

import { auth } from "@/auth";
import { getMealPlanPrices, MEAL_PLAN_DEFINITIONS } from "@/lib/arrangement-inclusions";
import { createCsvResponse, generateCsv, type CsvColumn } from "@/lib/csv";
import { todayDateOnly } from "@/lib/date-only";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const plans = [
  { code: "RO", name: "Tanpa makan" },
  { code: "BB", name: "Sarapan" },
  { code: "HB", name: "Sarapan + satu kali makan utama" },
  { code: "FB", name: "Sarapan, makan siang, dan makan malam" },
] as const satisfies readonly { code: ArrangementType; name: string }[];

type MealPlanRow = { code: ArrangementType; name: string; price: number };

const columns: CsvColumn<MealPlanRow>[] = [
  { header: "Kode Paket", accessor: (row) => row.code },
  { header: "Nama Paket", accessor: (row) => row.name },
  { header: "Kode Artikel", accessor: (row) => MEAL_PLAN_DEFINITIONS[row.code]?.articleCode ?? "-" },
  { header: "Harga (Rp/Tamu/Malam)", accessor: (row) => row.price },
  { header: "Keterangan", accessor: (row) => row.code === "RO" ? "Tetap" : "Dapat dikonfigurasi" },
];

export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Silakan masuk terlebih dahulu.", { status: 401 });
  if (!can(session.user.role, "revenue:read")) {
    return new Response("Anda tidak memiliki akses untuk mengekspor data pendapatan.", { status: 403 });
  }

  const prices = await getMealPlanPrices(prisma);
  const rows = plans.map((plan) => ({ ...plan, price: prices[plan.code] }));
  const date = todayDateOnly().today.toISOString().slice(0, 10);
  return createCsvResponse(generateCsv(columns, rows), `paket-makan-${date}.csv`);
}
