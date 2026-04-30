"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RoomRow } from "./room-table";

type RoomRowActionsProps = {
  room: RoomRow;
  onDelete: (room: RoomRow) => void;
  onEdit: (room: RoomRow) => void;
};

export function RoomRowActions({ room, onDelete, onEdit }: RoomRowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Actions for room ${room.number}`}
          />
        }
      >
        <MoreHorizontal aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => onEdit(room)}>
          <Pencil aria-hidden="true" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(room)}>
          <Trash2 aria-hidden="true" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
