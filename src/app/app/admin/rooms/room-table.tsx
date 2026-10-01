"use client";

import { BedDouble, Plus, Search, SearchX } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { RoomStatus } from "@prisma/client";
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
import { deleteRoom } from "./actions";
import { RoomForm, type RoomTypeOption } from "./room-form";
import { RoomRowActions } from "./room-row-actions";

export type RoomRow = {
  id: number;
  number: string;
  floor: number;
  roomTypeId: number;
  roomTypeName: string;
  status: RoomStatus;
};

type RoomTableProps = {
  rooms: RoomRow[];
  roomTypes: RoomTypeOption[];
};

const statusClassNames: Record<RoomStatus, string> = {
  VC: "border-status-vc-pip bg-status-vc-bg text-status-vc-fg",
  VD: "border-status-vd-pip bg-status-vd-bg text-status-vd-fg",
  OC: "border-status-oc-pip bg-status-oc-bg text-status-oc-fg",
  OD: "border-status-od-pip bg-status-od-bg text-status-od-fg",
  VCU: "border-status-vd-pip bg-status-vd-bg text-status-vd-fg",
  OOO: "border-status-ooo-pip bg-status-ooo-bg text-status-ooo-fg",
};


function AddRoomButton({
  disabled,
  onClick,
}: {
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      Tambah Kamar
    </Button>
  );
}

function StatusBadge({ status }: { status: RoomStatus }) {
  return (
    <SharedStatusBadge
      label={status}
      className={statusClassNames[status]}
      showPip={false}
    />
  );
}

export function RoomTable({ rooms, roomTypes }: RoomTableProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomRow | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<RoomRow | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<RoomStatus | "">("");
  const [isDeleting, startDeleteTransition] = useTransition();
  const hasRoomTypes = roomTypes.length > 0;

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: rooms.length,
      VC: 0,
      OC: 0,
      VD: 0,
      OD: 0,
      VCU: 0,
      OOO: 0,
    };
    for (const r of rooms) {
      if (counts[r.status] !== undefined) {
        counts[r.status]++;
      }
    }
    return counts;
  }, [rooms]);

  const roomTypeRateById = useMemo(
    () =>
      new Map(
        roomTypes.map((roomType) => [
          roomType.id,
          "baseRate" in roomType ? roomType.baseRate : undefined,
        ]),
      ),
    [roomTypes],
  );
  const filteredRooms = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rooms.filter((room) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        room.number.toLowerCase().includes(normalizedQuery) ||
        room.roomTypeName.toLowerCase().includes(normalizedQuery) ||
        room.status.toLowerCase().includes(normalizedQuery);

      const matchesStatus =
        statusFilter === "" || room.status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [query, statusFilter, rooms]);

  const statusFilterOptions: Array<{
    label: string;
    value: RoomStatus | "";
    countKey: string;
    dotClass: string;
  }> = [
    { label: "Semua", value: "", countKey: "ALL", dotClass: "bg-slate-400" },
    { label: "VC (Bersih)", value: "VC", countKey: "VC", dotClass: "bg-emerald-500" },
    { label: "OC (Terisi)", value: "OC", countKey: "OC", dotClass: "bg-sky-500" },
    { label: "VD (Kotor)", value: "VD", countKey: "VD", dotClass: "bg-amber-500" },
    { label: "OD (Kotor Terisi)", value: "OD", countKey: "OD", dotClass: "bg-orange-500" },
    { label: "VCU (Inspeksi)", value: "VCU", countKey: "VCU", dotClass: "bg-purple-500" },
    { label: "OOO (Rusak)", value: "OOO", countKey: "OOO", dotClass: "bg-rose-500" },
  ];

  function handleDelete() {
    if (!deletingRoom) {
      return;
    }

    startDeleteTransition(async () => {
      const result = await deleteRoom(deletingRoom.id);

      if (result.ok) {
        toast.success("Kamar dihapus");
        setDeletingRoom(null);
        return;
      }

      toast.error(result.error);
    });
  }

  return (
    <>
      <section className="rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border bg-card px-3.5 py-3 text-primary sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-[0.08em]">
              {"Daftar Kamar"}
            </h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {filteredRooms.length} / {rooms.length}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-11 desktop:h-10 min-w-[240px] items-center gap-2 rounded-lg border border-border bg-white px-2.5 text-slate-500 shadow-sm focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
              <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-slate-400"
                placeholder="Cari nomor, tipe, status..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="rounded p-0.5 text-xs text-slate-400 hover:text-slate-600"
                  aria-label="Hapus pencarian"
                >
                  ✕
                </button>
              ) : null}
            </div>
            <AddRoomButton
              disabled={!hasRoomTypes}
              onClick={() => setCreateOpen(true)}
            />
          </div>
        </div>

        {rooms.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-border/60 bg-slate-50/50 px-3.5 py-2">
            <span className="mr-1 text-xs font-semibold text-slate-500">Filter Status:</span>
            {statusFilterOptions.map((opt) => {
              const isSelected = statusFilter === opt.value;
              const count = statusCounts[opt.countKey] ?? 0;
              return (
                <button
                  key={opt.countKey}
                  type="button"
                  onClick={() => setStatusFilter(opt.value)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    isSelected
                      ? "bg-slate-900 text-white shadow-sm ring-1 ring-slate-900"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${opt.dotClass}`} />
                  <span>{opt.label}</span>
                  <span
                    className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-semibold ${
                      isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
            {(query || statusFilter) ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("");
                }}
                className="ml-auto text-xs font-medium text-slate-500 hover:text-primary underline"
              >
                Reset Filter
              </button>
            ) : null}
          </div>
        ) : null}

        {rooms.length === 0 ? (
          <EmptyState
            icon={BedDouble}
            title="Belum ada kamar"
            description={
              hasRoomTypes
                ? "Tambahkan kamar fisik untuk inventory hotel."
                : "Buat tipe kamar terlebih dahulu sebelum menambahkan kamar."
            }
            action={
              <AddRoomButton
                disabled={!hasRoomTypes}
                onClick={() => setCreateOpen(true)}
              />
            }
            className="m-3.5 min-h-56"
          />
        ) : (
          <div className="overflow-auto">
            <Table className="min-w-[760px] border-collapse text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="bg-card px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground text-primary">
                    Nomor
                  </TableHead>
                  <TableHead className="bg-card px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground text-primary">
                    Lantai
                  </TableHead>
                  <TableHead className="bg-card px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground text-primary">
                    Tipe
                  </TableHead>
                  <TableHead className="bg-card px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground text-primary">
                    Base Rate
                  </TableHead>
                  <TableHead className="bg-card px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground text-primary">
                    Status Saat Ini
                  </TableHead>
                  <TableHead className="w-16 bg-card px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground text-primary">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRooms.map((room) => (
                  <TableRow
                    key={room.id}
                    className="odd:bg-card even:bg-slate-50 hover:bg-status-vc-bg"
                  >
                    <TableCell className="num border-b border-border/60 px-3 py-[9px] font-semibold">
                      {room.number}
                    </TableCell>
                    <TableCell className="num border-b border-border/60 px-3 py-[9px] text-right">
                      {room.floor}
                    </TableCell>
                    <TableCell className="border-b border-border/60 px-3 py-[9px] font-medium">
                      {room.roomTypeName}
                    </TableCell>
                    <TableCell className="num border-b border-border/60 px-3 py-[9px] text-right">
                      {roomTypeRateById.get(room.roomTypeId)
                        ? formatIDR(roomTypeRateById.get(room.roomTypeId) ?? "0")
                        : "-"}
                    </TableCell>
                    <TableCell className="border-b border-border/60 px-3 py-[9px]">
                      <StatusBadge status={room.status} />
                    </TableCell>
                    <TableCell className="border-b border-border/60 px-3 py-[9px] text-right">
                      <RoomRowActions
                        room={room}
                        onDelete={setDeletingRoom}
                        onEdit={setEditingRoom}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {filteredRooms.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="border-b border-border/60 px-3 py-3"
                    >
                      <EmptyState
                        icon={SearchX}
                        title="Tidak ada kamar"
                        description="Tidak ada kamar yang cocok dengan filter atau kata kunci."
                        action={
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setQuery("");
                              setStatusFilter("");
                            }}
                          >
                            Reset Filter
                          </Button>
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-xl border border-border bg-card p-0 text-foreground sm:max-w-lg">
          <DialogHeader className="bg-slate-50 border-b border-border px-3.5 py-3 rounded-t-xl">
            <DialogTitle className="text-sm font-bold uppercase tracking-[0.08em] text-primary">
              {"Tambah Kamar"}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-400">
              Buat kamar fisik dan hubungkan ke tipe kamar.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3.5">
            <RoomForm
              roomTypes={roomTypes}
              onCancel={() => setCreateOpen(false)}
              onSaved={() => setCreateOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingRoom)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingRoom(null);
          }
        }}
      >
        <DialogContent className="rounded-xl border border-border bg-card p-0 text-foreground sm:max-w-lg">
          <DialogHeader className="bg-slate-50 border-b border-border px-3.5 py-3 rounded-t-xl">
            <DialogTitle className="text-sm font-bold uppercase tracking-[0.08em] text-primary">
              {"Edit Kamar"}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-400">
              Perbarui detail kamar dan status saat ini.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3.5">
            {editingRoom ? (
              <RoomForm
                defaultValues={editingRoom}
                roomTypes={roomTypes}
                onCancel={() => setEditingRoom(null)}
                onSaved={() => setEditingRoom(null)}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deletingRoom)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingRoom(null);
          }
        }}
      >
        <AlertDialogContent className="rounded-xl border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus kamar?</AlertDialogTitle>
            <AlertDialogDescription>
              Menghapus kamar {deletingRoom?.number ?? ""} dari inventaris
              kamar. Tindakan ini tidak dapat dibatalkan.
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
