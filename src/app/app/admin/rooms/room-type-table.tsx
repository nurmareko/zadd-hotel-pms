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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatIDR } from "@/lib/format";
import { deleteRoomType } from "./actions";
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
};

function AddRoomTypeButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" onClick={onClick}>
      <Plus aria-hidden="true" />
      Add Room Type
    </Button>
  );
}

export function RoomTypeTable({ roomTypes }: RoomTypeTableProps) {
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

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Room Types</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage categories, capacity, and base rates.
          </p>
        </div>
        {roomTypes.length > 0 ? (
          <AddRoomTypeButton onClick={() => setCreateOpen(true)} />
        ) : null}
      </div>

      {roomTypes.length === 0 ? (
        <div className="mt-6 flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Belum ada room type.
          </p>
          <div className="mt-4">
            <AddRoomTypeButton onClick={() => setCreateOpen(true)} />
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Capacity</TableHead>
                <TableHead className="text-right">Base Rate</TableHead>
                <TableHead className="w-16 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roomTypes.map((roomType) => (
                <TableRow key={roomType.id}>
                  <TableCell className="font-mono text-xs font-medium">
                    {roomType.code}
                  </TableCell>
                  <TableCell className="font-medium">
                    {roomType.name}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {roomType.capacity}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatIDR(roomType.baseRate)}
                  </TableCell>
                  <TableCell className="text-right">
                    <RoomTypeRowActions
                      roomType={roomType}
                      onDelete={setDeletingRoomType}
                      onEdit={setEditingRoomType}
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
            <DialogTitle>Add Room Type</DialogTitle>
            <DialogDescription>
              Create a room type for room inventory and reservations.
            </DialogDescription>
          </DialogHeader>
          <RoomTypeForm
            onCancel={() => setCreateOpen(false)}
            onSaved={() => setCreateOpen(false)}
          />
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Room Type</DialogTitle>
            <DialogDescription>
              Update the room type details and default rate.
            </DialogDescription>
          </DialogHeader>
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete room type?</AlertDialogTitle>
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
