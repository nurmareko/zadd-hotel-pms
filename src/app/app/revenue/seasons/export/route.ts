import type { Prisma, PricingRuleDayOfWeek } from "@prisma/client";

import { auth } from "@/auth";
import type { AppRole } from "@/auth.config";
import { createCsvResponse, generateCsv, type CsvColumn } from "@/lib/csv";
import { todayDateOnly } from "@/lib/date-only";
import { formatDecimalID, formatIDR } from "@/lib/format";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PricingRuleRow = Prisma.PricingRuleGetPayload<{ include: { roomType: true } }>;

const dayLabels: Record<PricingRuleDayOfWeek, string> = {
  MONDAY: "Senin",
  TUESDAY: "Selasa",
  WEDNESDAY: "Rabu",
  THURSDAY: "Kamis",
  FRIDAY: "Jumat",
  SATURDAY: "Sabtu",
  SUNDAY: "Minggu",
};

const columns: CsvColumn<PricingRuleRow>[] = [
  { header: "Nama Aturan", accessor: (rule) => rule.name },
  { header: "Kode Tipe Kamar", accessor: (rule) => rule.roomType.code },
  { header: "Tipe Kamar", accessor: (rule) => rule.roomType.name },
  { header: "Tarif Dasar (Rp)", accessor: (rule) => Number(rule.roomType.baseRate) },
  { header: "Jenis Periode", accessor: (rule) => rule.selectorKind === "DAY_OF_WEEK" ? "Hari mingguan" : "Rentang tanggal" },
  { header: "Hari", accessor: (rule) => rule.dayOfWeek ? dayLabels[rule.dayOfWeek] : "-" },
  { header: "Tanggal Mulai", accessor: (rule) => rule.startsOn?.toISOString().slice(0, 10) ?? "-" },
  { header: "Tanggal Selesai (Eksklusif)", accessor: (rule) => rule.endsBefore?.toISOString().slice(0, 10) ?? "-" },
  { header: "Jenis Penyesuaian", accessor: (rule) => rule.adjustmentKind === "AMOUNT_DELTA" ? "Nominal (Rp)" : "Persentase (%)" },
  {
    header: "Nilai Penyesuaian",
    accessor: (rule) => {
      const value = Number(rule.adjustmentValue);
      const sign = value > 0 ? "+" : "";
      return rule.adjustmentKind === "AMOUNT_DELTA"
        ? `${sign}${formatIDR(value)}`
        : `${sign}${formatDecimalID(value)}%`;
    },
  },
  { header: "Status", accessor: (rule) => rule.isActive ? "Aktif" : "Nonaktif" },
];

export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Silakan masuk terlebih dahulu.", { status: 401 });
  if (!can(session.user.role as AppRole, "revenue:read")) {
    return new Response("Anda tidak memiliki akses untuk mengekspor data pendapatan.", { status: 403 });
  }

  const rules = await prisma.pricingRule.findMany({
    include: { roomType: true },
    orderBy: [{ roomType: { name: "asc" } }, { name: "asc" }],
  });
  const date = todayDateOnly().today.toISOString().slice(0, 10);
  return createCsvResponse(generateCsv(columns, rules), `musim-tarif-${date}.csv`);
}
