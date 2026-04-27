"use client";

import { MoreHorizontal, Pencil, Power, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toggleMenuItemActive } from "./actions";
import type { MenuItemRow } from "./menu-table";

type MenuItemActionsProps = {
  item: MenuItemRow;
  onDelete: (item: MenuItemRow) => void;
  onEdit: (item: MenuItemRow) => void;
};

export function MenuItemActions({
  item,
  onDelete,
  onEdit,
}: MenuItemActionsProps) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleMenuItemActive(item.id);

      if (result.ok) {
        toast.success("Menu item status updated");
        return;
      }

      toast.error(result.error);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${item.name}`}
          />
        }
      >
        <MoreHorizontal aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => onEdit(item)}>
          <Pencil aria-hidden="true" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isPending} onClick={handleToggle}>
          <Power aria-hidden="true" />
          {item.isActive ? "Deactivate" : "Activate"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(item)}>
          <Trash2 aria-hidden="true" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
