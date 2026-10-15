"use client";

import { Plus, Tags } from "lucide-react";
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
import { EmptyState } from "@/components/ui/empty-state";
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


function AddRoomTypeButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" onClick={onClick}>
      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      Add Type
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
      <section className="rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-3 bg-card px-3.5 py-3 text-primary sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-bold uppercase tracking-[0.08em]">
            {"Room Types"}
          </h2>
          <AddRoomTypeButton onClick={() => setCreateOpen(true)} />
        </div>

        {roomTypes.length === 0 ? (
          <EmptyState
            icon={Tags}
            title="No room types yet"
            description="Create room types to define rates, capacity and inventory."
            action={<AddRoomTypeButton onClick={() => setCreateOpen(true)} />}
            className="m-3.5 min-h-56"
          />
        ) : (
          <div className="grid gap-3 p-3.5 md:grid-cols-3">
            {roomTypes.map((roomType) => (
              <article
                key={roomType.id}
                className="rounded-lg border border-border bg-card"
              >
                <div className="p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-sm font-semibold text-slate-500">
                        {roomType.code}
                      </div>
                      <h3 className="mt-0.5 text-[16px] font-semibold text-foreground">
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
                    <p className="mt-3 line-clamp-2 text-sm leading-5 text-slate-500">
                      {roomType.description}
                    </p>
                  ) : null}

                  <div className="my-3 border-t border-border/60" />

                  <div className="grid gap-1 text-[13px]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Capacity</span>
                      <span className="num font-medium">
                        {roomType.capacity} pax
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Base rate / night</span>
                      <span className="num font-semibold">
                        {formatIDR(roomType.baseRate)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Room count</span>
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
        <DialogContent className="rounded-xl border border-border bg-card p-0 text-foreground sm:max-w-lg">
          <DialogHeader className="bg-slate-50 border-b border-border px-3.5 py-3 rounded-t-xl">
            <DialogTitle className="text-sm font-bold uppercase tracking-[0.08em] text-primary">
              {"Add Room Type"}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-400">
              Create a room type for inventory and reservations.
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
        <DialogContent className="rounded-xl border border-border bg-card p-0 text-foreground sm:max-w-lg">
          <DialogHeader className="bg-slate-50 border-b border-border px-3.5 py-3 rounded-t-xl">
            <DialogTitle className="text-sm font-bold uppercase tracking-[0.08em] text-primary">
              {"Edit Room Type"}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-400">
              Update the room type details and default rate.
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
        <AlertDialogContent className="rounded-xl border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete room type?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete {deletingRoomType?.name ?? "this room type"} from the master data. This action cannot be undone.
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
