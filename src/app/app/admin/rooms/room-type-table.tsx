"use client";

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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatIDR } from "@/lib/format";
import { deleteRoomType } from "./actions";
import type { RoomRow } from "./room-table";
import { RoomTypeForm } from "./room-type-form";
import { RoomTypeRowActions } from "./room-type-row-actions";

export type RoomTypeRow = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  capacity: number;
  baseRate: string;
};

type RoomTypeTableProps = {
  roomTypes: RoomTypeRow[];
  rooms?: RoomRow[];
};

const primaryButtonClassName =
  "h-8 rounded-none border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800 hover:text-console-accent";

function AddRoomTypeButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" className={primaryButtonClassName} onClick={onClick}>
      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      Tambah Tipe
    </Button>
  );
}

export function RoomTypeTable({ roomTypes, rooms = [] }: RoomTypeTableProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRoomType, setEditingRoomType] =
    useState<RoomTypeRow | null>(null);
  const [deletingRoomType, setDeletingRoomType] =
    useState<RoomTypeRow | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  function handleDelete() {
    if (!deletingRoomType) {
      return;
    }

    startDeleteTransition(async () => {
      const result = await deleteRoomType(deletingRoomType.id);

      if (result.ok) {
        toast.success("Room type deleted");
        setDeletingRoomType(null);
        return;
      }

      toast.error(result.error);
    });
  }

  function roomCount(roomTypeId: number) {
    return rooms.filter((room) => room.roomTypeId === roomTypeId).length;
  }

  return (
    <>
      <section className="border border-console-border bg-console-surface">
        <div className="flex flex-col gap-3 bg-console-ink px-3.5 py-3 text-console-accent sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.08em]">
            {"// Tipe Kamar"}
          </h2>
          <AddRoomTypeButton onClick={() => setCreateOpen(true)} />
        </div>

        {roomTypes.length === 0 ? (
          <div className="m-3.5 flex min-h-56 flex-col items-center justify-center border border-dashed border-console-border bg-console-bg p-6 text-center">
            <p className="text-[12px] text-slate-500">Belum ada tipe kamar.</p>
            <div className="mt-4">
              <AddRoomTypeButton onClick={() => setCreateOpen(true)} />
            </div>
          </div>
        ) : (
          <div className="grid gap-3 p-3.5 md:grid-cols-3">
            {roomTypes.map((roomType) => (
              <article
                key={roomType.id}
                className="border border-console-border bg-console-surface"
              >
                <div className="p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-[11px] font-semibold text-slate-500">
                        {roomType.code}
                      </div>
                      <h3 className="mt-0.5 text-[16px] font-semibold text-console-ink">
                        {roomType.name}
                      </h3>
                    </div>
                    <RoomTypeRowActions
                      roomType={roomType}
                      onDelete={setDeletingRoomType}
                      onEdit={setEditingRoomType}
                    />
                  </div>

                  {roomType.description ? (
                    <p className="mt-3 line-clamp-2 text-[12px] leading-5 text-slate-500">
                      {roomType.description}
                    </p>
                  ) : null}

                  <div className="my-3 border-t border-console-border-soft" />

                  <div className="grid gap-1 text-[13px]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Kapasitas</span>
                      <span className="num font-medium">
                        {roomType.capacity} pax
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Base rate / malam</span>
                      <span className="num font-semibold">
                        {formatIDR(roomType.baseRate)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Jumlah kamar</span>
                      <span className="num font-medium">
                        {roomCount(roomType.id)}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-none border border-console-border bg-console-surface p-0 text-console-ink sm:max-w-lg">
          <DialogHeader className="bg-console-ink px-3.5 py-3">
            <DialogTitle className="text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
              {"// Tambah Tipe Kamar"}
            </DialogTitle>
            <DialogDescription className="text-[11px] text-slate-400">
              Buat tipe kamar untuk inventory dan reservasi.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3.5">
            <RoomTypeForm
              onCancel={() => setCreateOpen(false)}
              onSaved={() => setCreateOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingRoomType)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingRoomType(null);
          }
        }}
      >
        <DialogContent className="rounded-none border border-console-border bg-console-surface p-0 text-console-ink sm:max-w-lg">
          <DialogHeader className="bg-console-ink px-3.5 py-3">
            <DialogTitle className="text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
              {"// Edit Tipe Kamar"}
            </DialogTitle>
            <DialogDescription className="text-[11px] text-slate-400">
              Perbarui detail tipe kamar dan tarif default.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3.5">
            {editingRoomType ? (
              <RoomTypeForm
                defaultValues={{
                  ...editingRoomType,
                  baseRate: Number(editingRoomType.baseRate),
                }}
                onCancel={() => setEditingRoomType(null)}
                onSaved={() => setEditingRoomType(null)}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deletingRoomType)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingRoomType(null);
          }
        }}
      >
        <AlertDialogContent className="rounded-none border-console-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus tipe kamar?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {deletingRoomType?.name ?? "this room type"} from
              the master data. This action cannot be undone.
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
