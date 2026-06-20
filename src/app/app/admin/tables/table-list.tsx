"use client";

import { TableLocation, TableStatus } from "@prisma/client";
import { Plus, Search, SearchX, Table2 } from "lucide-react";
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
import { deleteRestaurantTable } from "./actions";
import { RestaurantTableForm } from "./table-form";
import { TableRowActions } from "./table-row-actions";

export type RestaurantTableRow = {
  id: number;
  number: string;
  capacity: number;
  location: TableLocation;
  status: TableStatus;
  notes: string | null;
  openOrderCount: number;
  totalOrderCount: number;
};

type TableListProps = {
  tables: RestaurantTableRow[];
  showHeading?: boolean;
};

const locationLabels: Record<TableLocation, string> = {
  INDOOR: "Indoor",
  OUTDOOR: "Outdoor",
  PRIVATE: "Private",
};

const statusLabels: Record<TableStatus, string> = {
  AVAILABLE: "Available",
  OCCUPIED: "Occupied",
  RESERVED: "Reserved",
  OUT_OF_SERVICE: "Out of Service",
};

const statusClassNames: Record<TableStatus, string> = {
  AVAILABLE: "border-status-vc-pip bg-status-vc-bg text-status-vc-fg",
  OCCUPIED: "border-status-oc-pip bg-status-oc-bg text-status-oc-fg",
  RESERVED: "border-status-vd-pip bg-status-vd-bg text-status-vd-fg",
  OUT_OF_SERVICE: "border-status-ooo-pip bg-status-ooo-bg text-status-ooo-fg",
};

const primaryButtonClassName = "h-9 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-600/90";

function AddTableButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" className={primaryButtonClassName} onClick={onClick}>
      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      Tambah Meja
    </Button>
  );
}

function StatusBadge({ status }: { status: TableStatus }) {
  return (
    <SharedStatusBadge
      label={statusLabels[status]}
      className={statusClassNames[status]}
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
    <section className="rounded-2xl border border-border bg-card p-3.5">
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

export function RestaurantTableList({
  tables,
  showHeading = true,
}: TableListProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTableRow | null>(
    null,
  );
  const [deletingTable, setDeletingTable] = useState<RestaurantTableRow | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState<TableLocation | "">("");
  const [statusFilter, setStatusFilter] = useState<TableStatus | "">("");
  const [isDeleting, startDeleteTransition] = useTransition();
  const totalCapacity = tables.reduce((sum, table) => sum + table.capacity, 0);
  const activeCount = tables.filter(
    (table) =>
      table.status === TableStatus.AVAILABLE ||
      table.status === TableStatus.OCCUPIED,
  ).length;
  const filteredTables = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return tables.filter((table) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        table.number.toLowerCase().includes(normalizedQuery) ||
        (table.notes?.toLowerCase().includes(normalizedQuery) ?? false);
      const matchesLocation = locationFilter
        ? table.location === locationFilter
        : true;
      const matchesStatus = statusFilter ? table.status === statusFilter : true;

      return matchesQuery && matchesLocation && matchesStatus;
    });
  }, [locationFilter, query, statusFilter, tables]);

  function handleDelete() {
    if (!deletingTable) {
      return;
    }

    startDeleteTransition(async () => {
      const result = await deleteRestaurantTable(deletingTable.id);

      if (result.ok) {
        toast.success("Meja dihapus");
        setDeletingTable(null);
        return;
      }

      toast.error(result.error);
    });
  }

  return (
    <>
      {showHeading ? (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="text-primary">&gt; </span>
              Restaurant Tables
            </h1>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              Master meja untuk floor plan F&amp;B Hotel Restaurant.
            </p>
          </div>
          <AddTableButton onClick={() => setCreateOpen(true)} />
        </div>
      ) : (
        <div className="mb-4 flex justify-end">
          <AddTableButton onClick={() => setCreateOpen(true)} />
        </div>
      )}

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <KpiCard
          label="Total Meja"
          value={tables.length}
          delta={`${activeCount} available / occupied`}
        />
        <KpiCard
          label="Total Kapasitas"
          value={totalCapacity}
          delta="Seat capacity"
        />
        <KpiCard
          label="Open Orders"
          value={tables.reduce((sum, table) => sum + table.openOrderCount, 0)}
          delta="Order aktif di meja"
        />
      </div>

      {tables.length === 0 ? (
        <EmptyState
          icon={Table2}
          title="Belum ada meja"
          description="Tambahkan meja restoran untuk floor plan dan order F&B."
          action={<AddTableButton onClick={() => setCreateOpen(true)} />}
          className="mt-8 min-h-56 bg-card"
        />
      ) : (
        <section className="rounded-2xl border border-border bg-card">
          <div className="flex flex-col gap-2 border-b border-border bg-card p-3.5 lg:flex-row lg:items-center">
            <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors">
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-slate-400"
                placeholder="Cari nomor meja..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <select
              className="h-8 border border-border bg-white px-2 text-sm text-foreground outline-none focus:border-primary"
              value={locationFilter}
              onChange={(event) =>
                setLocationFilter(event.target.value as TableLocation | "")
              }
            >
              <option value="">Semua Lokasi</option>
              {Object.values(TableLocation).map((location) => (
                <option key={location} value={location}>
                  {locationLabels[location]}
                </option>
              ))}
            </select>
            <select
              className="h-8 border border-border bg-white px-2 text-sm text-foreground outline-none focus:border-primary"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as TableStatus | "")
              }
            >
              <option value="">Semua Status</option>
              {Object.values(TableStatus).map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
            <span className="text-sm font-semibold uppercase tracking-[0.06em] text-slate-500 lg:ml-auto">
              <span className="num">{filteredTables.length}</span> meja
            </span>
          </div>
          <div className="overflow-auto">
            <Table className="min-w-[860px] border-collapse text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="bg-card px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground text-primary">
                    Nomor
                  </TableHead>
                  <TableHead className="bg-card px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground text-primary">
                    Kapasitas
                  </TableHead>
                  <TableHead className="bg-card px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground text-primary">
                    Lokasi
                  </TableHead>
                  <TableHead className="bg-card px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground text-primary">
                    Status
                  </TableHead>
                  <TableHead className="bg-card px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground text-primary">
                    Orders
                  </TableHead>
                  <TableHead className="bg-card px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground text-primary">
                    Catatan
                  </TableHead>
                  <TableHead className="w-16 bg-card px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground text-primary">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTables.map((table) => (
                  <TableRow
                    key={table.id}
                    className="odd:bg-card even:bg-slate-50 hover:bg-status-vc-bg"
                  >
                    <TableCell className="num border-b border-border/60 px-3 py-[9px] font-semibold">
                      {table.number}
                    </TableCell>
                    <TableCell className="num border-b border-border/60 px-3 py-[9px] text-right">
                      {table.capacity}
                    </TableCell>
                    <TableCell className="border-b border-border/60 px-3 py-[9px]">
                      {locationLabels[table.location]}
                    </TableCell>
                    <TableCell className="border-b border-border/60 px-3 py-[9px]">
                      <StatusBadge status={table.status} />
                    </TableCell>
                    <TableCell className="num border-b border-border/60 px-3 py-[9px] text-right">
                      {table.openOrderCount} / {table.totalOrderCount}
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate border-b border-border/60 px-3 py-[9px] text-slate-500">
                      {table.notes ?? "-"}
                    </TableCell>
                    <TableCell className="border-b border-border/60 px-3 py-[9px] text-right">
                      <TableRowActions
                        table={table}
                        onDelete={setDeletingTable}
                        onEdit={setEditingTable}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {filteredTables.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="border-b border-border/60 px-3 py-3"
                    >
                      <EmptyState
                        icon={SearchX}
                        title="Tidak ada meja"
                        description="Tidak ada meja yang cocok dengan filter."
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
        <DialogContent className="rounded-2xl border border-border bg-card p-0 text-foreground sm:max-w-lg">
          <DialogHeader className="bg-slate-50 border-b border-border px-3.5 py-3 rounded-t-2xl">
            <DialogTitle className="text-sm font-bold uppercase tracking-[0.08em] text-primary">
              {"Tambah Meja"}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-400">
              Buat meja restoran untuk floor plan F&amp;B.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3.5">
            <RestaurantTableForm
              onCancel={() => setCreateOpen(false)}
              onSaved={() => setCreateOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingTable)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingTable(null);
          }
        }}
      >
        <DialogContent className="rounded-2xl border border-border bg-card p-0 text-foreground sm:max-w-lg">
          <DialogHeader className="bg-slate-50 border-b border-border px-3.5 py-3 rounded-t-2xl">
            <DialogTitle className="text-sm font-bold uppercase tracking-[0.08em] text-primary">
              {"Edit Meja"}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-400">
              Perbarui detail meja dan status operasionalnya.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3.5">
            {editingTable ? (
              <RestaurantTableForm
                defaultValues={{
                  id: editingTable.id,
                  number: editingTable.number,
                  capacity: editingTable.capacity,
                  location: editingTable.location,
                  status: editingTable.status,
                  notes: editingTable.notes,
                }}
                onCancel={() => setEditingTable(null)}
                onSaved={() => setEditingTable(null)}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deletingTable)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingTable(null);
          }
        }}
      >
        <AlertDialogContent className="rounded-2xl border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus meja?</AlertDialogTitle>
            <AlertDialogDescription>
              Menghapus meja {deletingTable?.number ?? ""} dari floor plan
              F&amp;B. Meja dengan riwayat order tidak dapat dihapus.
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
