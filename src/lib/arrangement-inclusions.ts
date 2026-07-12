import { ArrangementType } from "@prisma/client";

export type ArrangementInclusionArticleCode =
  | "BREAKFAST"
  | "COFFEE-BREAK"
  | "LUNCH"
  | "DINNER";

/**
 * Canonical arrangement → nightly inclusion articles. Stay-charge posting
 * consumes this mapping for both night audit and check-out catch-up.
 */
export const ARRANGEMENT_INCLUSION_ARTICLE_CODES = Object.freeze({
  [ArrangementType.RO]: Object.freeze([]),
  [ArrangementType.RB]: Object.freeze(["BREAKFAST"]),
  [ArrangementType.FBM]: Object.freeze([
    "BREAKFAST",
    "COFFEE-BREAK",
    "LUNCH",
    "DINNER",
  ]),
} satisfies Record<ArrangementType, readonly ArrangementInclusionArticleCode[]>);
