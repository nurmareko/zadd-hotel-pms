"use client";

import { KeyRound, MoreHorizontal, Pencil, Power, Trash2 } from "lucide-react";
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
import { toggleUserActive } from "./actions";
import type { UserRow } from "./user-table";

type UserRowActionsProps = {
  user: UserRow;
  onDelete: (user: UserRow) => void;
  onEdit: (user: UserRow) => void;
  onResetPassword: (user: UserRow) => void;
};

export function UserRowActions({
  user,
  onDelete,
  onEdit,
  onResetPassword,
}: UserRowActionsProps) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleUserActive(user.id);

      if (result.ok) {
        toast.success("User status updated");
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
            aria-label={`Actions for ${user.username}`}
          />
        }
      >
        <MoreHorizontal aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onEdit(user)}>
          <Pencil aria-hidden="true" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onResetPassword(user)}>
          <KeyRound aria-hidden="true" />
          Reset Password
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isPending} onClick={handleToggle}>
          <Power aria-hidden="true" />
          {user.isActive ? "Deactivate" : "Activate"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(user)}>
          <Trash2 aria-hidden="true" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
