import { ArticleType } from "@prisma/client";

export const ARTICLE_DEPARTMENT_LABELS: Record<ArticleType, string> = {
  [ArticleType.ROOM]: "Front Office",
  [ArticleType.SERVICE]: "Housekeeping",
  [ArticleType.FB]: "Food & Beverage",
  [ArticleType.MISC]: "Spa & Lainnya",
  [ArticleType.TAX]: "Pajak",
};

export const POSTABLE_DEPARTMENTS: ArticleType[] = [
  ArticleType.ROOM,
  ArticleType.SERVICE,
  ArticleType.FB,
  ArticleType.MISC,
];

export function getArticleDepartmentLabel(type: ArticleType): string {
  return ARTICLE_DEPARTMENT_LABELS[type];
}
