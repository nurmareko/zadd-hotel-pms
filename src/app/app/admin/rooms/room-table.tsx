"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
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
  VC: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800",
  VD: "bg-yellow-50 text-yellow-800 ring-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:ring-yellow-800",
  OC: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-800",
  OD: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-800",
  OOO: "bg-muted text-muted-foreground ring-border",
};

function AddRoomButton({
  disabled,
  onClick,
}: {
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button type="button" disabled={disabled} onClick={onClick}>
      <Plus aria-hidden="true" />
      Add Room
    </Button>
  );
}

function StatusBadge({ status }: { status: RoomStatus }) {
  return <Badge className={statusClassNames[status]}>{status}</Badge>;
}

export function RoomTable({ rooms, roomTypes }: RoomTableProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomRow | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<RoomRow | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const hasRoomTypes = roomTypes.length > 0;

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Rooms</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage room numbers, floors, type assignments, and status.
          </p>
        </div>
        {rooms.length > 0 ? (
          <AddRoomButton
            disabled={!hasRoomTypes}
            onClick={() => setCreateOpen(true)}
          />
        ) : null}
      </div>

      {rooms.length === 0 ? (
        <div className="mt-6 flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">Belum ada room.</p>
          <div className="mt-4">
            <AddRoomButton
              disabled={!hasRoomTypes}
              onClick={() => setCreateOpen(true)}
            />
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead className="text-right">Floor</TableHead>
                <TableHead>Room Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.map((room) => (
                <TableRow key={room.id}>
                  <TableCell className="font-mono text-xs font-medium">
                    {room.number}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {room.floor}
                  </TableCell>
                  <TableCell className="font-medium">
                    {room.roomTypeName}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={room.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <RoomRowActions
                      room={room}
                      onDelete={setDeletingRoom}
                      onEdit={setEditingRoom}
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
            <DialogTitle>Add Room</DialogTitle>
            <DialogDescription>
              Create a physical room and assign it to a room type.
            </DialogDescription>
          </DialogHeader>
          <RoomForm
            roomTypes={roomTypes}
            onCancel={() => setCreateOpen(false)}
            onSaved={() => setCreateOpen(false)}
          />
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Room</DialogTitle>
            <DialogDescription>
              Update room details and current room status.
            </DialogDescription>
          </DialogHeader>
          {editingRoom ? (
            <RoomForm
              defaultValues={editingRoom}
              roomTypes={roomTypes}
              onCancel={() => setEditingRoom(null)}
              onSaved={() => setEditingRoom(null)}
            />
          ) : null}
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete room?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes room {deletingRoom?.number ?? ""} from room
              inventory. This action cannot be undone.
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
