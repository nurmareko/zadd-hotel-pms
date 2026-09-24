import type { ArrangementType, Prisma, PrismaClient } from "@prisma/client";

export const MEAL_ARTICLE_CODES = ["MEAL-BB", "MEAL-HB", "MEAL-FB"] as const;

export type MealArticleCode = (typeof MEAL_ARTICLE_CODES)[number];

export type MealPlanDefinition = {
  articleCode: MealArticleCode;
  unitPrice: number;
};

/** Canonical article identity and fallback prices when catalog prices are absent. */
export const MEAL_PLAN_DEFINITIONS = Object.freeze({
  RO: null,
  BB: Object.freeze({ articleCode: "MEAL-BB", unitPrice: 50_000 }),
  HB: Object.freeze({ articleCode: "MEAL-HB", unitPrice: 150_000 }),
  FB: Object.freeze({ articleCode: "MEAL-FB", unitPrice: 250_000 }),
} satisfies Record<ArrangementType, MealPlanDefinition | null>);

/** Load only on the server; pure snapshot/browser consumers do not initialize Prisma. */
export async function getMealPlanPrices(
  prismaClientOrTx?: PrismaClient | Prisma.TransactionClient,
): Promise<Record<ArrangementType, number>> {
  const client = prismaClientOrTx ?? (await import("@/lib/prisma")).prisma;
  const articles = await client.article.findMany({
    where: { code: { in: [...MEAL_ARTICLE_CODES] } },
    select: { code: true, defaultPrice: true },
  });
  const prices: Record<ArrangementType, number> = { RO: 0, BB: 0, HB: 0, FB: 0 };
  for (const plan of ["BB", "HB", "FB"] as const) {
    const definition = MEAL_PLAN_DEFINITIONS[plan];
    const article = articles.find((article) => article.code === definition.articleCode);
    prices[plan] = article?.defaultPrice?.toNumber() ?? definition.unitPrice;
  }
  return prices;
}
