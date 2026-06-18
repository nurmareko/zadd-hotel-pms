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
import type { RoomTypeRow } from "./room-type-table";

type RoomTypeRowActionsProps = {
  roomType: RoomTypeRow;
  onDelete: (roomType: RoomTypeRow) => void;
  onEdit: (roomType: RoomTypeRow) => void;
};

export function RoomTypeRowActions({
  roomType,
  onDelete,
  onEdit,
}: RoomTypeRowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-none text-foreground hover:bg-slate-50"
            aria-label={`Actions for ${roomType.name}`}
          />
        }
      >
        <MoreHorizontal aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => onEdit(roomType)}>
          <Pencil aria-hidden="true" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onDelete(roomType)}
        >
          <Trash2 aria-hidden="true" />
          Hapus
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
