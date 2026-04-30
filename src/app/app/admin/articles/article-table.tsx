"use client";

import { ArticleType } from "@prisma/client";
import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  ROOM: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-800",
  FB: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800",
  SERVICE:
    "bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:ring-cyan-800",
  TAX: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800",
  MISC: "bg-muted text-muted-foreground ring-border",
};

function AddArticleButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" onClick={onClick}>
      <Plus aria-hidden="true" />
      Add Article
    </Button>
  );
}

function TypeBadge({ type }: { type: ArticleType }) {
  return <Badge className={typeClassNames[type]}>{type}</Badge>;
}

export function ArticleTable({ articles }: ArticleTableProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<ArticleRow | null>(null);
  const [deletingArticle, setDeletingArticle] =
    useState<ArticleRow | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  function handleDelete() {
    if (!deletingArticle) {
      return;
    }

    startDeleteTransition(async () => {
      const result = await deleteArticle(deletingArticle.id);

      if (result.ok) {
        toast.success("Article deleted");
        setDeletingArticle(null);
        return;
      }

      toast.error(result.error);
    });
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Articles</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage charge codes for folios and billing.
          </p>
        </div>
        {articles.length > 0 ? (
          <AddArticleButton onClick={() => setCreateOpen(true)} />
        ) : null}
      </div>

      {articles.length === 0 ? (
        <div className="mt-8 flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">Belum ada article.</p>
          <div className="mt-4">
            <AddArticleButton onClick={() => setCreateOpen(true)} />
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Default Price</TableHead>
                <TableHead className="w-16 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {articles.map((article) => (
                <TableRow key={article.id}>
                  <TableCell className="font-mono text-xs font-medium">
                    {article.code}
                  </TableCell>
                  <TableCell className="font-medium">{article.name}</TableCell>
                  <TableCell>
                    <TypeBadge type={article.type} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {article.defaultPrice
                      ? formatIDR(article.defaultPrice)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <ArticleRowActions
                      article={article}
                      onDelete={setDeletingArticle}
                      onEdit={setEditingArticle}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Article</DialogTitle>
            <DialogDescription>
              Create a charge code for billing workflows.
            </DialogDescription>
          </DialogHeader>
          <ArticleForm
            onCancel={() => setCreateOpen(false)}
            onSaved={() => setCreateOpen(false)}
          />
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Article</DialogTitle>
            <DialogDescription>
              Update the charge code shown in billing workflows.
            </DialogDescription>
          </DialogHeader>
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete article?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {deletingArticle?.name ?? "this article"} from
              charge code master data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
