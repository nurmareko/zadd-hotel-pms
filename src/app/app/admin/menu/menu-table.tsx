"use client";

import { Plus, Search, SearchX, Utensils } from "lucide-react";
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
import { StatusBadge as SharedStatusBadge } from "@/components/status-badge";
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

const primaryButtonClassName = "h-9 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-600/90";

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
    <SharedStatusBadge
      label={isActive ? "Aktif" : "Nonaktif"}
      className={className}
      showPip={false}
    />
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
    <section className="rounded-lg border border-border bg-card p-3.5">
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-slate-600">
        [ {label} ]
      </div>
      <div className="num mt-2 text-[22px] font-bold leading-tight text-foreground">
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
        toast.success("Menu dihapus");
        setDeletingItem(null);
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
              <BreadcrumbPage>Menu</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              F&amp;B Menu
            </h1>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              Outlet: Hotel Restaurant (single outlet untuk MVP).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <AddMenuItemButton onClick={() => setCreateOpen(true)} />
          </div>
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
        <EmptyState
          icon={Utensils}
          title="Belum ada menu"
          description="Tambahkan item menu agar F&B dapat membuat order."
          action={<AddMenuItemButton onClick={() => setCreateOpen(true)} />}
          className="mt-8 min-h-56 bg-card"
        />
      ) : (
        <section className="rounded-lg border border-border bg-card">
          <div className="flex flex-col gap-2 border-b border-border bg-card p-3.5 lg:flex-row lg:items-center">
            <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors">
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-slate-400"
                placeholder="Cari menu..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <select
              className="h-8 border border-border bg-white px-2 text-sm text-foreground outline-none focus:border-primary"
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
              className="h-8 border border-border bg-white px-2 text-sm text-foreground outline-none focus:border-primary"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "active" | "inactive" | "")
              }
            >
              <option value="">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
            <span className="text-sm font-semibold uppercase tracking-[0.06em] text-slate-500 lg:ml-auto">
              <span className="num">{filteredItems.length}</span> menu
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
                    Nama Menu
                  </TableHead>
                  <TableHead className="bg-card px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground text-primary">
                    Kategori
                  </TableHead>
                  <TableHead className="bg-card px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground text-primary">
                    Harga
                  </TableHead>
                  <TableHead className="bg-card px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground text-primary">
                    Status
                  </TableHead>
                  <TableHead className="w-16 bg-card px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground text-primary">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow
                    key={item.id}
                    className="odd:bg-card even:bg-slate-50 hover:bg-status-vc-bg"
                  >
                    <TableCell className="border-b border-border/60 px-3 py-[9px] font-medium text-sm font-medium">
                      {item.code}
                    </TableCell>
                    <TableCell className="border-b border-border/60 px-3 py-[9px] font-semibold">
                      {item.name}
                    </TableCell>
                    <TableCell className="border-b border-border/60 px-3 py-[9px]">
                      {item.category}
                    </TableCell>
                    <TableCell className="num border-b border-border/60 px-3 py-[9px] text-right font-semibold">
                      {formatIDR(item.price)}
                    </TableCell>
                    <TableCell className="border-b border-border/60 px-3 py-[9px]">
                      <StatusBadge isActive={item.isActive} />
                    </TableCell>
                    <TableCell className="border-b border-border/60 px-3 py-[9px] text-right">
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
                      className="border-b border-border/60 px-3 py-3"
                    >
                      <EmptyState
                        icon={SearchX}
                        title="Tidak ada menu"
                        description="Tidak ada menu yang cocok dengan filter."
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
        <DialogContent className="rounded-[10px] border border-border bg-card p-0 text-foreground sm:max-w-lg">
          <DialogHeader className="bg-slate-50 border-b border-border px-3.5 py-3 rounded-t-[10px]">
            <DialogTitle className="text-sm font-bold uppercase tracking-[0.08em] text-primary">
              {"Tambah Menu"}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-400">
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
        <DialogContent className="rounded-[10px] border border-border bg-card p-0 text-foreground sm:max-w-lg">
          <DialogHeader className="bg-slate-50 border-b border-border px-3.5 py-3 rounded-t-[10px]">
            <DialogTitle className="text-sm font-bold uppercase tracking-[0.08em] text-primary">
              {"Edit Menu"}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-400">
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
        <AlertDialogContent className="rounded-[10px] border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus menu?</AlertDialogTitle>
            <AlertDialogDescription>
              Menghapus {deletingItem?.name ?? "menu ini"} dari menu
              F&amp;B. Tindakan ini tidak dapat dibatalkan.
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
