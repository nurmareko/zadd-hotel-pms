import { prisma } from "@/lib/prisma";
import { PricingPreview } from "./pricing-preview";
import { PricingRuleTable } from "./pricing-rule-table";

export const dynamic = "force-dynamic";

export default async function PricingRulesPage() {
  const [roomTypes, pricingRules] = await Promise.all([
    prisma.roomType.findMany({
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        baseRate: true,
      },
    }),
    prisma.pricingRule.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        roomTypeId: true,
        selectorKind: true,
        dayOfWeek: true,
        startsOn: true,
        endsBefore: true,
        adjustmentKind: true,
        adjustmentValue: true,
        isActive: true,
        roomType: {
          select: {
            code: true,
            name: true,
          },
        },
      },
    }),
  ]);

  const serializedRoomTypes = roomTypes.map((roomType) => ({
    ...roomType,
    baseRate: roomType.baseRate.toString(),
  }));
  const serializedRules = pricingRules.map((rule) => ({
    id: rule.id,
    name: rule.name,
    roomTypeId: rule.roomTypeId,
    roomTypeCode: rule.roomType.code,
    roomTypeName: rule.roomType.name,
    selectorKind: rule.selectorKind,
    dayOfWeek: rule.dayOfWeek,
    startsOn: rule.startsOn?.toISOString().slice(0, 10) ?? null,
    endsBefore: rule.endsBefore?.toISOString().slice(0, 10) ?? null,
    adjustmentKind: rule.adjustmentKind,
    adjustmentValue: rule.adjustmentValue.toString(),
    isActive: rule.isActive,
  }));
  const previewVersion = JSON.stringify(serializedRules);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-4 text-foreground md:px-6 md:py-5">
      <div className="space-y-6">
        <PricingRuleTable
          rules={serializedRules}
          roomTypes={serializedRoomTypes}
        />
        <PricingPreview
          key={previewVersion}
          roomTypes={serializedRoomTypes}
        />
      </div>
    </main>
  );
}
