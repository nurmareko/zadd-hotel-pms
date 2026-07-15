"use server";

import {
  Prisma,
  PricingRuleSelectorKind,
  type PricingRule,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { parseISODateOnly } from "@/lib/date-only";
import {
  applyPricingRuleAdjustment,
  PricingResolutionError,
  resolveNightlySchedule,
} from "@/lib/pricing-resolver";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import {
  PricingPreviewSchema,
  PricingRuleCreateSchema,
  PricingRuleIdSchema,
  PricingRuleToggleSchema,
  PricingRuleUpdateSchema,
} from "./schema";

const PRICING_RULES_PATH = "/app/admin/pricing-rules";
const SERIALIZABLE_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  ...TRANSACTION_OPTIONS,
} as const;

type ActionResult =
  | { ok: true }
  | { ok: false; error: string; field?: string };

type RuleMutationData = Pick<
  PricingRule,
  | "roomTypeId"
  | "name"
  | "selectorKind"
  | "dayOfWeek"
  | "startsOn"
  | "endsBefore"
  | "adjustmentKind"
  | "adjustmentValue"
  | "isActive"
>;

export type PricingPreviewResult =
  | {
      ok: true;
      baseRate: string;
      flatTotal: string;
      resolvedTotal: string;
      nights: Array<{
        date: string;
        rate: string;
        sourceRule: {
          id: string;
          name: string;
          selectorKind: PricingRuleSelectorKind;
        } | null;
      }>;
    }
  | { ok: false; error: string; field?: string };

function validationFailure(error: {
  issues: { message: string; path: PropertyKey[] }[];
}): { ok: false; error: string; field?: string } {
  const issue = error.issues[0];
  const field = typeof issue?.path[0] === "string" ? issue.path[0] : undefined;

  return {
    ok: false,
    error: issue?.message ?? "Data aturan harga tidak valid",
    field,
  };
}

async function canManagePricingRules() {
  const session = await auth();
  return session?.user.role === "ADMIN";
}

function dateOnlyFromISO(value: string | null | undefined) {
  return value ? parseISODateOnly(value) : null;
}

function mutationData(input: {
  roomTypeId: number;
  name: string;
  selectorKind: RuleMutationData["selectorKind"];
  dayOfWeek?: RuleMutationData["dayOfWeek"];
  startsOn?: string | null;
  endsBefore?: string | null;
  adjustmentKind: RuleMutationData["adjustmentKind"];
  adjustmentValue: string;
  isActive: boolean;
}): RuleMutationData {
  return {
    roomTypeId: input.roomTypeId,
    name: input.name,
    selectorKind: input.selectorKind,
    dayOfWeek:
      input.selectorKind === PricingRuleSelectorKind.DAY_OF_WEEK
        ? (input.dayOfWeek ?? null)
        : null,
    startsOn:
      input.selectorKind === PricingRuleSelectorKind.DATE_RANGE
        ? dateOnlyFromISO(input.startsOn)
        : null,
    endsBefore:
      input.selectorKind === PricingRuleSelectorKind.DATE_RANGE
        ? dateOnlyFromISO(input.endsBefore)
        : null,
    adjustmentKind: input.adjustmentKind,
    adjustmentValue: new Prisma.Decimal(input.adjustmentValue),
    isActive: input.isActive,
  };
}

async function validateRuleConstraints(
  tx: Prisma.TransactionClient,
  data: RuleMutationData,
  excludeId?: string,
): Promise<ActionResult> {
  const roomType = await tx.roomType.findUnique({
    where: { id: data.roomTypeId },
    select: { baseRate: true },
  });

  if (!roomType) {
    return { ok: false, error: "Tipe kamar tidak ditemukan", field: "roomTypeId" };
  }

  const finalRate = applyPricingRuleAdjustment(
    roomType.baseRate,
    data.adjustmentKind,
    data.adjustmentValue,
  );

  if (finalRate.isNegative()) {
    return {
      ok: false,
      error: "Penyesuaian menghasilkan tarif malam negatif",
      field: "adjustmentValue",
    };
  }

  if (!data.isActive) {
    return { ok: true };
  }

  if (
    data.selectorKind === PricingRuleSelectorKind.DAY_OF_WEEK &&
    data.dayOfWeek
  ) {
    const duplicate = await tx.pricingRule.findFirst({
      where: {
        roomTypeId: data.roomTypeId,
        dayOfWeek: data.dayOfWeek,
        isActive: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (duplicate) {
      return {
        ok: false,
        error: "Sudah ada aturan aktif untuk hari tersebut pada tipe kamar ini",
        field: "dayOfWeek",
      };
    }
  }

  if (
    data.selectorKind === PricingRuleSelectorKind.DATE_RANGE &&
    data.startsOn &&
    data.endsBefore
  ) {
    const overlap = await tx.pricingRule.findFirst({
      where: {
        roomTypeId: data.roomTypeId,
        selectorKind: PricingRuleSelectorKind.DATE_RANGE,
        isActive: true,
        startsOn: { lt: data.endsBefore },
        endsBefore: { gt: data.startsOn },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (overlap) {
      return {
        ok: false,
        error: "Rentang tanggal aktif tumpang tindih dengan aturan lain",
        field: "startsOn",
      };
    }
  }

  return { ok: true };
}

function prismaErrorResult(error: unknown): ActionResult {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return {
        ok: false,
        error:
          "Aturan hari untuk tipe kamar tersebut sudah ada, termasuk aturan nonaktif",
        field: "dayOfWeek",
      };
    }

    if (error.code === "P2025") {
      return { ok: false, error: "Aturan harga tidak ditemukan" };
    }

    if (error.code === "P2034" || error.code === "P2028") {
      return {
        ok: false,
        error: "Data aturan harga berubah bersamaan. Silakan coba lagi.",
      };
    }
  }

  return { ok: false, error: "Terjadi kesalahan saat menyimpan aturan harga" };
}

export async function createPricingRule(input: unknown): Promise<ActionResult> {
  if (!(await canManagePricingRules())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = PricingRuleCreateSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const data = mutationData(parsed.data);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const validation = await validateRuleConstraints(tx, data);
      if (!validation.ok) return validation;
      await tx.pricingRule.create({ data });
      return { ok: true as const };
    }, SERIALIZABLE_OPTIONS);

    if (result.ok) revalidatePath(PRICING_RULES_PATH);
    return result;
  } catch (error) {
    return prismaErrorResult(error);
  }
}

export async function updatePricingRule(input: unknown): Promise<ActionResult> {
  if (!(await canManagePricingRules())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = PricingRuleUpdateSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const { id, ...values } = parsed.data;
  const data = mutationData(values);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.pricingRule.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing) return { ok: false as const, error: "Aturan harga tidak ditemukan" };

      const validation = await validateRuleConstraints(tx, data, id);
      if (!validation.ok) return validation;
      await tx.pricingRule.update({ where: { id }, data });
      return { ok: true as const };
    }, SERIALIZABLE_OPTIONS);

    if (result.ok) revalidatePath(PRICING_RULES_PATH);
    return result;
  } catch (error) {
    return prismaErrorResult(error);
  }
}

export async function togglePricingRule(input: unknown): Promise<ActionResult> {
  if (!(await canManagePricingRules())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = PricingRuleToggleSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.pricingRule.findUnique({
        where: { id: parsed.data.id },
      });
      if (!existing) return { ok: false as const, error: "Aturan harga tidak ditemukan" };

      const data = { ...existing, isActive: parsed.data.isActive };
      const validation = await validateRuleConstraints(tx, data, existing.id);
      if (!validation.ok) return validation;
      await tx.pricingRule.update({
        where: { id: existing.id },
        data: { isActive: parsed.data.isActive },
      });
      return { ok: true as const };
    }, SERIALIZABLE_OPTIONS);

    if (result.ok) revalidatePath(PRICING_RULES_PATH);
    return result;
  } catch (error) {
    return prismaErrorResult(error);
  }
}

export async function deletePricingRule(id: string): Promise<ActionResult> {
  if (!(await canManagePricingRules())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = PricingRuleIdSchema.safeParse({ id });
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    await prisma.pricingRule.delete({ where: { id: parsed.data.id } });
    revalidatePath(PRICING_RULES_PATH);
    return { ok: true };
  } catch (error) {
    return prismaErrorResult(error);
  }
}

export async function previewPricingSchedule(
  input: unknown,
): Promise<PricingPreviewResult> {
  if (!(await canManagePricingRules())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = PricingPreviewSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    const schedule = await resolveNightlySchedule({
      roomTypeId: parsed.data.roomTypeId,
      arrivalDate: parsed.data.arrivalDate,
      departureDate: parsed.data.departureDate,
    });
    const baseRate = schedule[0].baseRate;
    const flatTotal = baseRate.mul(schedule.length);
    const resolvedTotal = schedule.reduce(
      (sum, night) => sum.plus(night.rate),
      new Prisma.Decimal(0),
    );

    return {
      ok: true,
      baseRate: baseRate.toString(),
      flatTotal: flatTotal.toString(),
      resolvedTotal: resolvedTotal.toString(),
      nights: schedule.map((night) => ({
        date: night.date.toISOString().slice(0, 10),
        rate: night.rate.toString(),
        sourceRule: night.sourceRule,
      })),
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof PricingResolutionError
          ? error.message
          : "Gagal menghitung pratinjau harga",
    };
  }
}
