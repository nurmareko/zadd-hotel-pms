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
  BB: Object.freeze(["BREAKFAST"]),
  get HB(): readonly ArrangementInclusionArticleCode[] {
    throw new Error("Posting paket HB belum tersedia sampai Phase 2.");
  },
  FB: Object.freeze([
    "BREAKFAST",
    "COFFEE-BREAK",
    "LUNCH",
    "DINNER",
  ]),
} satisfies Record<ArrangementType, readonly ArrangementInclusionArticleCode[]>);
