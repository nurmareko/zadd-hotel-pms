import { ArticleType } from "@prisma/client";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  ARTICLE_DEPARTMENT_LABELS,
  getArticleDepartmentLabel,
  POSTABLE_DEPARTMENTS,
} from "./article-departments";

const expectedLabels = {
  ROOM: "Front Office",
  SERVICE: "Housekeeping",
  FB: "Food & Beverage",
  MISC: "Spa & Lainnya",
  TAX: "Pajak",
} satisfies Record<ArticleType, string>;

describe("Issue291 article departments", () => {
  it("provides the exact department labels for every ArticleType", () => {
    expectTypeOf(ARTICLE_DEPARTMENT_LABELS).toEqualTypeOf<Record<ArticleType, string>>();
    expect(ARTICLE_DEPARTMENT_LABELS).toEqual(expectedLabels);
    expect(Object.keys(ARTICLE_DEPARTMENT_LABELS).sort()).toEqual(
      Object.values(ArticleType).sort(),
    );
  });

  it.each(Object.values(ArticleType))("resolves the department label for %s", (type) => {
    expect(getArticleDepartmentLabel(type)).toBe(expectedLabels[type]);
  });

  it("lists all four operational departments in display order without TAX", () => {
    expect(POSTABLE_DEPARTMENTS).toEqual([
      ArticleType.ROOM,
      ArticleType.SERVICE,
      ArticleType.FB,
      ArticleType.MISC,
    ]);
    expect(POSTABLE_DEPARTMENTS).not.toContain(ArticleType.TAX);
    expect([...POSTABLE_DEPARTMENTS].sort()).toEqual(
      Object.values(ArticleType).filter((type) => type !== ArticleType.TAX).sort(),
    );
  });
});
