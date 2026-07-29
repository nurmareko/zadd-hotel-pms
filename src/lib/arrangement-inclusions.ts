import type { ArrangementType } from "@prisma/client";

export const MEAL_ARTICLE_CODES = ["MEAL-BB", "MEAL-HB", "MEAL-FB"] as const;

export type MealArticleCode = (typeof MEAL_ARTICLE_CODES)[number];

export type MealPlanDefinition = {
  articleCode: MealArticleCode;
  unitPrice: number;
};

/** Canonical meal-plan metadata used to snapshot and post nightly meals. */
export const MEAL_PLAN_DEFINITIONS = Object.freeze({
  RO: null,
  BB: Object.freeze({ articleCode: "MEAL-BB", unitPrice: 50_000 }),
  HB: Object.freeze({ articleCode: "MEAL-HB", unitPrice: 150_000 }),
  FB: Object.freeze({ articleCode: "MEAL-FB", unitPrice: 250_000 }),
} satisfies Record<ArrangementType, MealPlanDefinition | null>);
