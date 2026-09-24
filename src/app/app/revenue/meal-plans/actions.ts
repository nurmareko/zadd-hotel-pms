"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { MEAL_PLAN_DEFINITIONS } from "@/lib/arrangement-inclusions";
import { can } from "@/lib/permissions";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { MealPlanPricesSchema } from "./schema";

export async function updateMealPlanPrices(input: unknown): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "pricing_rules:manage")) {
    return { ok: false, error: "Anda tidak memiliki izin mengubah harga paket makan." };
  }
  const parsed = MealPlanPricesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Harga paket makan tidak valid." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Updating existing rows only: a missing article rolls back the entire catalog edit.
      for (const plan of ["BB", "HB", "FB"] as const) {
        await tx.article.update({
          where: { code: MEAL_PLAN_DEFINITIONS[plan].articleCode },
          data: { defaultPrice: new Prisma.Decimal(parsed.data[plan]) },
        });
      }
    }, TRANSACTION_OPTIONS);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { ok: false, error: "Artikel paket makan belum lengkap. Tidak ada harga yang disimpan." };
    }
    return { ok: false, error: "Gagal menyimpan harga paket makan. Silakan coba lagi." };
  }

  // A refresh failure must not report that a committed catalog update failed.
  try {
    revalidatePath("/app/revenue/meal-plans");
    revalidatePath("/app/fo/reservasi/new");
    revalidatePath("/app/fo/reservasi/[id]", "page");
    revalidatePath("/app/fo/reservasi/grup/[groupBookingId]", "page");
    revalidatePath("/app/admin/articles");
  } catch {
    console.error("Gagal menyegarkan tampilan setelah harga paket makan disimpan.");
  }
  return { ok: true };
}
