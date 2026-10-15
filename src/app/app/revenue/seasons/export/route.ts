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
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

const columns: CsvColumn<PricingRuleRow>[] = [
  { header: "Rule Name", accessor: (rule) => rule.name },
  { header: "Room Type Code", accessor: (rule) => rule.roomType.code },
  { header: "Room Type", accessor: (rule) => rule.roomType.name },
  { header: "Base Rate (IDR)", accessor: (rule) => Number(rule.roomType.baseRate) },
  { header: "Period Type", accessor: (rule) => rule.selectorKind === "DAY_OF_WEEK" ? "Weekday" : "Date range" },
  { header: "Day", accessor: (rule) => rule.dayOfWeek ? dayLabels[rule.dayOfWeek] : "-" },
  { header: "Start Date", accessor: (rule) => rule.startsOn?.toISOString().slice(0, 10) ?? "-" },
  { header: "End Date (Exclusive)", accessor: (rule) => rule.endsBefore?.toISOString().slice(0, 10) ?? "-" },
  { header: "Adjustment Type", accessor: (rule) => rule.adjustmentKind === "AMOUNT_DELTA" ? "Amount (IDR)" : "Percentage (%)" },
  {
    header: "Adjustment Value",
    accessor: (rule) => {
      const value = Number(rule.adjustmentValue);
      const sign = value > 0 ? "+" : "";
      return rule.adjustmentKind === "AMOUNT_DELTA"
        ? `${sign}${formatIDR(value)}`
        : `${sign}${formatDecimalID(value)}%`;
    },
  },
  { header: "Status", accessor: (rule) => rule.isActive ? "Active" : "Inactive" },
];

export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Please sign in first.", { status: 401 });
  if (!can(session.user.role as AppRole, "revenue:read")) {
    return new Response("You do not have permission to export revenue data.", { status: 403 });
  }

  const rules = await prisma.pricingRule.findMany({
    include: { roomType: true },
    orderBy: [{ roomType: { name: "asc" } }, { name: "asc" }],
  });
  const date = todayDateOnly().today.toISOString().slice(0, 10);
  return createCsvResponse(generateCsv(columns, rules), `seasons-rates-${date}.csv`);
}
