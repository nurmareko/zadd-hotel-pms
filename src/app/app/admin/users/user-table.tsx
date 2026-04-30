"use client";

import { Plus } from "lucide-react";
import { FormEvent, useState, useTransition } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteUser, resetUserPassword } from "./actions";
import { UserForm } from "./user-form";
import { UserRowActions } from "./user-row-actions";
import type { RoleCode } from "./schema";

export type UserRow = {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  role: RoleCode;
  isActive: boolean;
};

type UserTableProps = {
  users: UserRow[];
};

function AddUserButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" onClick={onClick}>
      <Plus aria-hidden="true" />
      Add User
    </Button>
  );
}

function RoleBadge({ role }: { role: RoleCode }) {
  const className =
    role === "ADMIN"
      ? "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800"
      : "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-800";

  return <Badge className={className}>{role}</Badge>;
}

function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge
      className={
        isActive
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800"
          : "bg-muted text-muted-foreground ring-border"
      }
    >
      {isActive ? "Active" : "Inactive"}
    </Badge>
  );
}

export function UserTable({ users }: UserTableProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserRow | null>(null);
  const [resettingUser, setResettingUser] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isResetting, startResetTransition] = useTransition();

  function handleDelete() {
    if (!deletingUser) {
      return;
    }

    startDeleteTransition(async () => {
      const result = await deleteUser(deletingUser.id);

      if (result.ok) {
        toast.success("User deleted");
        setDeletingUser(null);
        return;
      }

      toast.error(result.error);
    });
  }

  function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!resettingUser) {
      return;
    }

    startResetTransition(async () => {
      const result = await resetUserPassword({
        id: resettingUser.id,
        password: newPassword,
      });

      if (result.ok) {
        toast.success("Password reset");
        setResettingUser(null);
        setNewPassword("");
        return;
      }

      toast.error(result.error);
    });
  }

  function closeResetDialog() {
    setResettingUser(null);
    setNewPassword("");
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            User Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage student and administrator accounts.
          </p>
        </div>
        {users.length > 0 ? (
          <AddUserButton onClick={() => setCreateOpen(true)} />
        ) : null}
      </div>

      {users.length === 0 ? (
        <div className="mt-8 flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">Belum ada user.</p>
          <div className="mt-4">
            <AddUserButton onClick={() => setCreateOpen(true)} />
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-mono text-xs font-medium">
                    {user.username}
                  </TableCell>
                  <TableCell className="font-medium">
                    {user.fullName}
                  </TableCell>
                  <TableCell>{user.email ?? "—"}</TableCell>
                  <TableCell>
                    <RoleBadge role={user.role} />
                  </TableCell>
                  <TableCell>
                    <ActiveBadge isActive={user.isActive} />
                  </TableCell>
                  <TableCell className="text-right">
                    <UserRowActions
                      user={user}
                      onDelete={setDeletingUser}
                      onEdit={setEditingUser}
                      onResetPassword={setResettingUser}
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
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>
              Create a user account and assign one module role.
            </DialogDescription>
          </DialogHeader>
          <UserForm
            onCancel={() => setCreateOpen(false)}
            onSaved={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingUser)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingUser(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update account details and the assigned role.
            </DialogDescription>
          </DialogHeader>
          {editingUser ? (
            <UserForm
              defaultValues={editingUser}
              onCancel={() => setEditingUser(null)}
              onSaved={() => setEditingUser(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(resettingUser)}
        onOpenChange={(open) => {
          if (!open) {
            closeResetDialog();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {resettingUser?.username ?? "this user"}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Minimum 6 characters"
              />
            </div>
            <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isResetting}
                onClick={closeResetDialog}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isResetting}>
                {isResetting ? "Saving..." : "Reset Password"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deletingUser)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingUser(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {deletingUser?.username ?? "this user"} from the
              system. This action cannot be undone.
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
