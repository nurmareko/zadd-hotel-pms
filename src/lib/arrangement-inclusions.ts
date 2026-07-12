import type { ArrangementType } from "@prisma/client";

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
  RO: Object.freeze([]),
  RB: Object.freeze(["BREAKFAST"]),
  FBM: Object.freeze([
    "BREAKFAST",
    "COFFEE-BREAK",
    "LUNCH",
    "DINNER",
  ]),
} satisfies Record<ArrangementType, readonly ArrangementInclusionArticleCode[]>);
