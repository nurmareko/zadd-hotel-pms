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

const primaryButtonClassName =
  "h-8 rounded-none border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800 hover:text-console-accent";

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
            <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
              <span className="text-console-accent">&gt; </span>
              Restaurant Tables
            </h1>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
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
          className="mt-8 min-h-56 bg-console-surface"
        />
      ) : (
        <section className="border border-console-border bg-console-surface">
          <div className="flex flex-col gap-2 border-b border-console-border bg-console-surface p-3.5 lg:flex-row lg:items-center">
            <div className="flex h-8 min-w-0 flex-1 items-center gap-2 border border-console-border bg-white px-2.5 text-slate-500">
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              <input
                className="min-w-0 flex-1 bg-transparent text-[12px] text-console-ink outline-none placeholder:text-slate-400"
                placeholder="Cari nomor meja..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <select
              className="h-8 border border-console-border bg-white px-2 text-[12px] text-console-ink outline-none focus:border-console-ink"
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
              className="h-8 border border-console-border bg-white px-2 text-[12px] text-console-ink outline-none focus:border-console-ink"
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
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 lg:ml-auto">
              <span className="num">{filteredTables.length}</span> meja
            </span>
          </div>
          <div className="overflow-auto">
            <Table className="min-w-[860px] border-collapse text-[12px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                    Nomor
                  </TableHead>
                  <TableHead className="bg-console-ink px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                    Kapasitas
                  </TableHead>
                  <TableHead className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                    Lokasi
                  </TableHead>
                  <TableHead className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                    Status
                  </TableHead>
                  <TableHead className="bg-console-ink px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                    Orders
                  </TableHead>
                  <TableHead className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                    Catatan
                  </TableHead>
                  <TableHead className="w-16 bg-console-ink px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTables.map((table) => (
                  <TableRow
                    key={table.id}
                    className="odd:bg-console-surface even:bg-console-bg hover:bg-status-vc-bg"
                  >
                    <TableCell className="num border-b border-console-border-soft px-3 py-[9px] font-semibold">
                      {table.number}
                    </TableCell>
                    <TableCell className="num border-b border-console-border-soft px-3 py-[9px] text-right">
                      {table.capacity}
                    </TableCell>
                    <TableCell className="border-b border-console-border-soft px-3 py-[9px]">
                      {locationLabels[table.location]}
                    </TableCell>
                    <TableCell className="border-b border-console-border-soft px-3 py-[9px]">
                      <StatusBadge status={table.status} />
                    </TableCell>
                    <TableCell className="num border-b border-console-border-soft px-3 py-[9px] text-right">
                      {table.openOrderCount} / {table.totalOrderCount}
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate border-b border-console-border-soft px-3 py-[9px] text-slate-500">
                      {table.notes ?? "-"}
                    </TableCell>
                    <TableCell className="border-b border-console-border-soft px-3 py-[9px] text-right">
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
                      className="border-b border-console-border-soft px-3 py-3"
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
        <DialogContent className="rounded-none border border-console-border bg-console-surface p-0 text-console-ink sm:max-w-lg">
          <DialogHeader className="bg-console-ink px-3.5 py-3">
            <DialogTitle className="text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
              {"Tambah Meja"}
            </DialogTitle>
            <DialogDescription className="text-[11px] text-slate-400">
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
        <DialogContent className="rounded-none border border-console-border bg-console-surface p-0 text-console-ink sm:max-w-lg">
          <DialogHeader className="bg-console-ink px-3.5 py-3">
            <DialogTitle className="text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
              {"Edit Meja"}
            </DialogTitle>
            <DialogDescription className="text-[11px] text-slate-400">
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
        <AlertDialogContent className="rounded-none border-console-border">
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
