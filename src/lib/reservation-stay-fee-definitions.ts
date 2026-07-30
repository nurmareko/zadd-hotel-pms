import type { ReservationStayFeeKind } from "@prisma/client";

export const STAY_FEE_DEFINITIONS = Object.freeze({
  EARLY_CHECK_IN: Object.freeze({
    articleCode: "FEE-EARLY-CI",
    label: "Check-in lebih awal",
    unitPrice: 100_000,
  }),
  LATE_CHECK_OUT: Object.freeze({
    articleCode: "FEE-LATE-CO",
    label: "Check-out lebih lambat",
    unitPrice: 100_000,
  }),
} satisfies Record<
  ReservationStayFeeKind,
  { articleCode: string; label: string; unitPrice: number }
>);

export const STAY_FEE_ARTICLE_CODES = Object.freeze(
  Object.values(STAY_FEE_DEFINITIONS).map((definition) => definition.articleCode),
);
