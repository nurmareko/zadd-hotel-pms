"use client";

import { ArticleType } from "@prisma/client";
import { Newspaper, Plus, Search, SearchX } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatIDR } from "@/lib/format";
import { deleteArticle } from "./actions";
import { ArticleForm } from "./article-form";
import { ArticleRowActions } from "./article-row-actions";
import { articleTypes } from "./schema";

export type ArticleRow = {
  id: number;
  code: string;
  name: string;
  type: ArticleType;
  defaultPrice: string | null;
};

type ArticleTableProps = {
  articles: ArticleRow[];
};

const typeClassNames: Record<ArticleType, string> = {
  ROOM: "border-status-oc-pip bg-status-oc-bg text-status-oc-fg",
  FB: "border-status-vc-pip bg-status-vc-bg text-status-vc-fg",
  SERVICE: "border-status-vd-pip bg-status-vd-bg text-status-vd-fg",
  TAX: "border-status-ooo-pip bg-status-ooo-bg text-status-ooo-fg",
  MISC: "border-slate-400 bg-status-ooo-bg text-status-ooo-fg",
};

const primaryButtonClassName = "h-9 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-600/90";

function AddArticleButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" className={primaryButtonClassName} onClick={onClick}>
      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      Tambah Article
    </Button>
  );
}

function TypeBadge({ type }: { type: ArticleType }) {
  return (
    <StatusBadge
      label={type}
      className={typeClassNames[type]}
      showPip={false}
    />
  );
}

export function ArticleTable({ articles }: ArticleTableProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<ArticleRow | null>(null);
  const [deletingArticle, setDeletingArticle] =
    useState<ArticleRow | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<ArticleType | "">("");
  const [isDeleting, startDeleteTransition] = useTransition();
  const filteredArticles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return articles.filter((article) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        article.code.toLowerCase().includes(normalizedQuery) ||
        article.name.toLowerCase().includes(normalizedQuery);
      const matchesType = typeFilter ? article.type === typeFilter : true;

      return matchesQuery && matchesType;
    });
  }, [articles, query, typeFilter]);

  function handleDelete() {
    if (!deletingArticle) {
      return;
    }

    startDeleteTransition(async () => {
      const result = await deleteArticle(deletingArticle.id);

      if (result.ok) {
        toast.success("Artikel dihapus");
        setDeletingArticle(null);
        return;
      }

      toast.error(result.error);
    });
  }

  return (
    <>
      <div className="mb-4">
        <Breadcrumb className="mb-2">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/app/admin">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Articles</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Articles (Charge Codes)
            </h1>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              Daftar kode charge yang digunakan untuk posting line item folio.
            </p>
          </div>
          <AddArticleButton onClick={() => setCreateOpen(true)} />
        </div>
      </div>

      {articles.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title="Belum ada article"
          description="Tambahkan charge code untuk posting folio dan billing."
          action={<AddArticleButton onClick={() => setCreateOpen(true)} />}
          className="mt-8 min-h-56 bg-card"
        />
      ) : (
        <section className="rounded-lg border border-border bg-card">
          <div className="flex flex-col gap-2 border-b border-border bg-card p-3.5 lg:flex-row lg:items-center">
            <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors">
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-slate-400"
                placeholder="Cari kode atau nama..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <select
              className="h-8 border border-border bg-white px-2 text-sm text-foreground outline-none focus:border-primary"
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(event.target.value as ArticleType | "")
              }
            >
              <option value="">Semua Tipe</option>
              {articleTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <span className="text-sm font-semibold uppercase tracking-[0.06em] text-slate-500 lg:ml-auto">
              <span className="num">{filteredArticles.length}</span> articles
            </span>
          </div>
          <div className="overflow-auto">
            <Table className="min-w-[760px] border-collapse text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="bg-card px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground text-primary">
                    Code
                  </TableHead>
                  <TableHead className="bg-card px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground text-primary">
                    Nama
                  </TableHead>
                  <TableHead className="bg-card px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground text-primary">
                    Tipe
                  </TableHead>
                  <TableHead className="bg-card px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground text-primary">
                    Default Price
                  </TableHead>
                  <TableHead className="w-16 bg-card px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground text-primary">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredArticles.map((article) => (
                  <TableRow
                    key={article.id}
                    className="odd:bg-card even:bg-slate-50 hover:bg-status-vc-bg"
                  >
                    <TableCell className="border-b border-border/60 px-3 py-[9px] font-medium text-sm font-semibold">
                      {article.code}
                    </TableCell>
                    <TableCell className="border-b border-border/60 px-3 py-[9px] font-semibold">
                      {article.name}
                    </TableCell>
                    <TableCell className="border-b border-border/60 px-3 py-[9px]">
                      <TypeBadge type={article.type} />
                    </TableCell>
                    <TableCell className="num border-b border-border/60 px-3 py-[9px] text-right">
                      {article.defaultPrice
                        ? formatIDR(article.defaultPrice)
                        : "-"}
                    </TableCell>
                    <TableCell className="border-b border-border/60 px-3 py-[9px] text-right">
                      <ArticleRowActions
                        article={article}
                        onDelete={setDeletingArticle}
                        onEdit={setEditingArticle}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {filteredArticles.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="border-b border-border/60 px-3 py-3"
                    >
                      <EmptyState
                        icon={SearchX}
                        title="Tidak ada article"
                        description="Tidak ada article yang cocok dengan filter."
                      />
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-xl border border-border bg-card p-0 text-foreground sm:max-w-lg">
          <DialogHeader className="bg-slate-50 border-b border-border px-3.5 py-3 rounded-t-xl">
            <DialogTitle className="text-sm font-bold uppercase tracking-[0.08em] text-primary">
              {"Tambah Article"}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-400">
              Buat kode charge untuk workflow billing.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3.5">
            <ArticleForm
              onCancel={() => setCreateOpen(false)}
              onSaved={() => setCreateOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingArticle)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingArticle(null);
          }
        }}
      >
        <DialogContent className="rounded-xl border border-border bg-card p-0 text-foreground sm:max-w-lg">
          <DialogHeader className="bg-slate-50 border-b border-border px-3.5 py-3 rounded-t-xl">
            <DialogTitle className="text-sm font-bold uppercase tracking-[0.08em] text-primary">
              {"Edit Article"}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-400">
              Perbarui kode charge yang tampil di workflow billing.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3.5">
            {editingArticle ? (
              <ArticleForm
                defaultValues={{
                  ...editingArticle,
                  defaultPrice: editingArticle.defaultPrice
                    ? Number(editingArticle.defaultPrice)
                    : null,
                }}
                onCancel={() => setEditingArticle(null)}
                onSaved={() => setEditingArticle(null)}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deletingArticle)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingArticle(null);
          }
        }}
      >
        <AlertDialogContent className="rounded-xl border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus artikel?</AlertDialogTitle>
            <AlertDialogDescription>
              Menghapus {deletingArticle?.name ?? "artikel ini"} dari master
              data kode biaya. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
