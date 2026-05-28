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

const primaryButtonClassName =
  "h-8 rounded-none border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800 hover:text-console-accent";

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
      className={primaryButtonClassName}
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
  const [isDeleting, startDeleteTransition] = useTransition();
  const hasRoomTypes = roomTypes.length > 0;
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

    return rooms.filter(
      (room) =>
        normalizedQuery.length === 0 ||
        room.number.toLowerCase().includes(normalizedQuery) ||
        room.roomTypeName.toLowerCase().includes(normalizedQuery) ||
        room.status.toLowerCase().includes(normalizedQuery),
    );
  }, [query, rooms]);

  function handleDelete() {
    if (!deletingRoom) {
      return;
    }

    startDeleteTransition(async () => {
      const result = await deleteRoom(deletingRoom.id);

      if (result.ok) {
        toast.success("Room deleted");
        setDeletingRoom(null);
        return;
      }

      toast.error(result.error);
    });
  }

  return (
    <>
      <section className="border border-console-border bg-console-surface">
        <div className="flex flex-col gap-3 border-b border-console-border bg-console-ink px-3.5 py-3 text-console-accent sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.08em]">
            {"// Daftar Kamar"}
          </h2>
          <div className="flex flex-wrap gap-2">
            <div className="flex h-8 min-w-[220px] items-center gap-2 border border-console-border bg-white px-2.5 text-slate-500">
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              <input
                className="min-w-0 flex-1 bg-transparent text-[12px] text-console-ink outline-none placeholder:text-slate-400"
                placeholder="Cari nomor kamar..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <AddRoomButton
              disabled={!hasRoomTypes}
              onClick={() => setCreateOpen(true)}
            />
          </div>
        </div>

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
            <Table className="min-w-[760px] border-collapse text-[12px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                    Nomor
                  </TableHead>
                  <TableHead className="bg-console-ink px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                    Lantai
                  </TableHead>
                  <TableHead className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                    Tipe
                  </TableHead>
                  <TableHead className="bg-console-ink px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                    Base Rate
                  </TableHead>
                  <TableHead className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                    Status Saat Ini
                  </TableHead>
                  <TableHead className="w-16 bg-console-ink px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRooms.map((room) => (
                  <TableRow
                    key={room.id}
                    className="odd:bg-console-surface even:bg-console-bg hover:bg-status-vc-bg"
                  >
                    <TableCell className="num border-b border-console-border-soft px-3 py-[9px] font-semibold">
                      {room.number}
                    </TableCell>
                    <TableCell className="num border-b border-console-border-soft px-3 py-[9px] text-right">
                      {room.floor}
                    </TableCell>
                    <TableCell className="border-b border-console-border-soft px-3 py-[9px] font-medium">
                      {room.roomTypeName}
                    </TableCell>
                    <TableCell className="num border-b border-console-border-soft px-3 py-[9px] text-right">
                      {roomTypeRateById.get(room.roomTypeId)
                        ? formatIDR(roomTypeRateById.get(room.roomTypeId) ?? "0")
                        : "-"}
                    </TableCell>
                    <TableCell className="border-b border-console-border-soft px-3 py-[9px]">
                      <StatusBadge status={room.status} />
                    </TableCell>
                    <TableCell className="border-b border-console-border-soft px-3 py-[9px] text-right">
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
                      className="border-b border-console-border-soft px-3 py-3"
                    >
                      <EmptyState
                        icon={SearchX}
                        title="Tidak ada kamar"
                        description="Tidak ada kamar yang cocok dengan filter."
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
        <DialogContent className="rounded-none border border-console-border bg-console-surface p-0 text-console-ink sm:max-w-lg">
          <DialogHeader className="bg-console-ink px-3.5 py-3">
            <DialogTitle className="text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
              {"// Tambah Kamar"}
            </DialogTitle>
            <DialogDescription className="text-[11px] text-slate-400">
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
        <DialogContent className="rounded-none border border-console-border bg-console-surface p-0 text-console-ink sm:max-w-lg">
          <DialogHeader className="bg-console-ink px-3.5 py-3">
            <DialogTitle className="text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
              {"// Edit Kamar"}
            </DialogTitle>
            <DialogDescription className="text-[11px] text-slate-400">
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
        <AlertDialogContent className="rounded-none border-console-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus kamar?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes room {deletingRoom?.number ?? ""} from room
              inventory. This action cannot be undone.
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
