import { prisma } from "@/lib/prisma";
import { ArticleTable } from "./article-table";

export default async function ArticlesPage() {
  const articles = await prisma.article.findMany({
    orderBy: [{ type: "asc" }, { code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      defaultPrice: true,
    },
  });

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-4 text-foreground md:px-6 md:py-5">
      <ArticleTable
        articles={articles.map((article) => ({
          ...article,
          defaultPrice: article.defaultPrice?.toString() ?? null,
        }))}
      />
    </main>
  );
}
