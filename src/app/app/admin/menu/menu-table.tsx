"use client";

import { Plus, Search } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
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
import { deleteMenuItem } from "./actions";
import { MenuForm } from "./menu-form";
import { MenuItemActions } from "./menu-item-actions";

export type MenuItemRow = {
  id: number;
  code: string;
  name: string;
  category: string;
  price: string;
  isActive: boolean;
};

type MenuTableProps = {
  items: MenuItemRow[];
};

const primaryButtonClassName =
  "h-8 rounded-none border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800 hover:text-console-accent";

function AddMenuItemButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" className={primaryButtonClassName} onClick={onClick}>
      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      Tambah Menu
    </Button>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  const className = isActive
    ? "border-status-vc-pip bg-status-vc-bg text-status-vc-fg"
    : "border-status-ooo-pip bg-status-ooo-bg text-status-ooo-fg";

  return (
    <span
      className={`inline-flex h-5 items-center border px-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${className}`}
    >
      {isActive ? "Aktif" : "Nonaktif"}
    </span>
  );
}

function KpiCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string | number;
  delta: string;
}) {
  return (
    <section className="border border-console-border bg-console-surface p-3.5">
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-slate-600">
        [ {label} ]
      </div>
      <div className="num mt-2 text-[22px] font-bold leading-tight text-console-ink">
        {value}
      </div>
      <div className="mt-1 text-[10px] text-slate-500">{delta}</div>
    </section>
  );
}

export function MenuTable({ items }: MenuTableProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItemRow | null>(null);
  const [deletingItem, setDeletingItem] = useState<MenuItemRow | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "">(
    "",
  );
  const [isDeleting, startDeleteTransition] = useTransition();
  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.category))).sort(),
    [items],
  );
  const activeCount = items.filter((item) => item.isActive).length;
  const averagePrice =
    items.length > 0
      ? items.reduce((sum, item) => sum + Number(item.price), 0) / items.length
      : 0;
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return items.filter((item) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        item.code.toLowerCase().includes(normalizedQuery) ||
        item.name.toLowerCase().includes(normalizedQuery);
      const matchesCategory = categoryFilter
        ? item.category === categoryFilter
        : true;
      const matchesStatus =
        statusFilter === "active"
          ? item.isActive
          : statusFilter === "inactive"
            ? !item.isActive
            : true;

      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [categoryFilter, items, query, statusFilter]);

  function handleDelete() {
    if (!deletingItem) {
      return;
    }

    startDeleteTransition(async () => {
      const result = await deleteMenuItem(deletingItem.id);

      if (result.ok) {
        toast.success("Menu item deleted");
        setDeletingItem(null);
        return;
      }

      toast.error(result.error);
    });
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
            <span className="text-console-accent">▸ </span>
            F&amp;B Menu
          </h1>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">
            Outlet: Hotel Restaurant (single outlet untuk MVP).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AddMenuItemButton onClick={() => setCreateOpen(true)} />
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <KpiCard
          label="Total Menu Aktif"
          value={activeCount}
          delta={`${items.length - activeCount} nonaktif`}
        />
        <KpiCard
          label="Kategori"
          value={categories.length}
          delta={categories.join(", ") || "-"}
        />
        <KpiCard
          label="Avg. Price"
          value={formatIDR(Math.round(averagePrice).toString())}
          delta="Per item"
        />
      </div>

      {items.length === 0 ? (
        <div className="mt-8 flex min-h-56 flex-col items-center justify-center border border-dashed border-console-border bg-console-surface p-6 text-center">
          <p className="text-[12px] text-slate-500">Belum ada menu item.</p>
          <div className="mt-4">
            <AddMenuItemButton onClick={() => setCreateOpen(true)} />
          </div>
        </div>
      ) : (
        <section className="border border-console-border bg-console-surface">
          <div className="flex flex-col gap-2 border-b border-console-border bg-console-surface p-3.5 lg:flex-row lg:items-center">
            <div className="flex h-8 min-w-0 flex-1 items-center gap-2 border border-console-border bg-white px-2.5 text-slate-500">
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              <input
                className="min-w-0 flex-1 bg-transparent text-[12px] text-console-ink outline-none placeholder:text-slate-400"
                placeholder="Cari menu..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <select
              className="h-8 border border-console-border bg-white px-2 text-[12px] text-console-ink outline-none focus:border-console-ink"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="">Semua Kategori</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <select
              className="h-8 border border-console-border bg-white px-2 text-[12px] text-console-ink outline-none focus:border-console-ink"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "active" | "inactive" | "")
              }
            >
              <option value="">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 lg:ml-auto">
              <span className="num">{filteredItems.length}</span> menu
            </span>
          </div>
          <div className="overflow-auto">
            <Table className="min-w-[760px] border-collapse text-[12px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                    Code
                  </TableHead>
                  <TableHead className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                    Nama Menu
                  </TableHead>
                  <TableHead className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                    Kategori
                  </TableHead>
                  <TableHead className="bg-console-ink px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                    Harga
                  </TableHead>
                  <TableHead className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                    Status
                  </TableHead>
                  <TableHead className="w-16 bg-console-ink px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow
                    key={item.id}
                    className="odd:bg-console-surface even:bg-console-bg hover:bg-status-vc-bg"
                  >
                    <TableCell className="border-b border-console-border-soft px-3 py-[9px] font-mono text-[12px] font-medium">
                      {item.code}
                    </TableCell>
                    <TableCell className="border-b border-console-border-soft px-3 py-[9px] font-semibold">
                      {item.name}
                    </TableCell>
                    <TableCell className="border-b border-console-border-soft px-3 py-[9px]">
                      {item.category}
                    </TableCell>
                    <TableCell className="num border-b border-console-border-soft px-3 py-[9px] text-right font-semibold">
                      {formatIDR(item.price)}
                    </TableCell>
                    <TableCell className="border-b border-console-border-soft px-3 py-[9px]">
                      <StatusBadge isActive={item.isActive} />
                    </TableCell>
                    <TableCell className="border-b border-console-border-soft px-3 py-[9px] text-right">
                      <MenuItemActions
                        item={item}
                        onDelete={setDeletingItem}
                        onEdit={setEditingItem}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="border-b border-console-border-soft px-3 py-10 text-center text-[12px] text-slate-500"
                    >
                      Tidak ada menu yang cocok dengan filter.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-none border border-console-border bg-console-surface p-0 text-console-ink sm:max-w-lg">
          <DialogHeader className="bg-console-ink px-3.5 py-3">
            <DialogTitle className="text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
              {"// Tambah Menu"}
            </DialogTitle>
            <DialogDescription className="text-[11px] text-slate-400">
              Buat menu untuk flow order F&amp;B.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3.5">
            <MenuForm
              onCancel={() => setCreateOpen(false)}
              onSaved={() => setCreateOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingItem)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingItem(null);
          }
        }}
      >
        <DialogContent className="rounded-none border border-console-border bg-console-surface p-0 text-console-ink sm:max-w-lg">
          <DialogHeader className="bg-console-ink px-3.5 py-3">
            <DialogTitle className="text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
              {"// Edit Menu"}
            </DialogTitle>
            <DialogDescription className="text-[11px] text-slate-400">
              Perbarui detail menu yang tampil untuk pengguna F&amp;B.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3.5">
            {editingItem ? (
              <MenuForm
                defaultValues={{
                  id: editingItem.id,
                  code: editingItem.code,
                  name: editingItem.name,
                  category: editingItem.category,
                  price: Number(editingItem.price),
                }}
                onCancel={() => setEditingItem(null)}
                onSaved={() => setEditingItem(null)}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deletingItem)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingItem(null);
          }
        }}
      >
        <AlertDialogContent className="rounded-none border-console-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus menu?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {deletingItem?.name ?? "this menu item"} from the
              F&amp;B menu. This action cannot be undone.
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
