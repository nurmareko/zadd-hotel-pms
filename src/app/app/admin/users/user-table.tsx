"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Plus, Search } from "lucide-react";
import { FormEvent, useMemo, useState, useTransition } from "react";
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

type SortDirection = "asc" | "desc" | null;

const buttonClassName =
  "h-8 rounded-none border-console-border bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg";

const primaryButtonClassName =
  "h-8 rounded-none border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800 hover:text-console-accent";

const roleClassNames: Record<RoleCode, string> = {
  FO: "border-blue-500 bg-status-oc-bg text-status-oc-fg",
  HK: "border-amber-500 bg-status-vd-bg text-status-vd-fg",
  FB: "border-emerald-500 bg-status-vc-bg text-status-vc-fg",
  ACC: "border-slate-500 bg-status-ooo-bg text-status-ooo-fg",
  ADMIN: "border-red-500 bg-status-od-bg text-status-od-fg",
};

function AddUserButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" className={primaryButtonClassName} onClick={onClick}>
      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      Tambah Pengguna
    </Button>
  );
}

function RoleBadge({ role }: { role: RoleCode }) {
  return (
    <Badge
      className={`h-5 rounded-none border px-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${roleClassNames[role]}`}
    >
      {role}
    </Badge>
  );
}

function ActiveBadge({ isActive }: { isActive: boolean }) {
  const className = isActive
    ? "border-status-vc-pip bg-status-vc-bg text-status-vc-fg"
    : "border-status-ooo-pip bg-status-ooo-bg text-status-ooo-fg";

  return (
    <Badge
      className={`h-5 rounded-none border px-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${className}`}
    >
      {isActive ? "Aktif" : "Nonaktif"}
    </Badge>
  );
}

function userInitials(fullName: string) {
  return fullName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserTable({ users }: UserTableProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserRow | null>(null);
  const [resettingUser, setResettingUser] = useState<UserRow | null>(null);
  const [query, setQuery] = useState("");
  const [nameSort, setNameSort] = useState<SortDirection>(null);
  const [roleFilter, setRoleFilter] = useState<RoleCode | "">("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "">(
    "",
  );
  const [newPassword, setNewPassword] = useState("");
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isResetting, startResetTransition] = useTransition();
  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return users.filter((user) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        user.fullName.toLowerCase().includes(normalizedQuery) ||
        user.username.toLowerCase().includes(normalizedQuery) ||
        (user.email ?? "").toLowerCase().includes(normalizedQuery);
      const matchesRole = roleFilter ? user.role === roleFilter : true;
      const matchesStatus =
        statusFilter === "active"
          ? user.isActive
          : statusFilter === "inactive"
            ? !user.isActive
            : true;

      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [query, roleFilter, statusFilter, users]);
  const displayedUsers = useMemo(() => {
    if (!nameSort) {
      return filteredUsers;
    }

    return [...filteredUsers].sort((firstUser, secondUser) => {
      const nameComparison = firstUser.fullName.localeCompare(
        secondUser.fullName,
        "id",
        { sensitivity: "base" },
      );
      const comparison =
        nameComparison ||
        firstUser.username.localeCompare(secondUser.username, "id", {
          sensitivity: "base",
        });

      return nameSort === "asc" ? comparison : -comparison;
    });
  }, [filteredUsers, nameSort]);

  function toggleNameSort() {
    setNameSort((currentSort) => (currentSort === "asc" ? "desc" : "asc"));
  }

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
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
            <span className="text-console-accent">▸ </span>
            Pengelolaan Pengguna
          </h1>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">
            Kelola akun praktikum dan penetapan role.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AddUserButton onClick={() => setCreateOpen(true)} />
        </div>
      </div>

      {users.length === 0 ? (
        <div className="mt-8 flex min-h-56 flex-col items-center justify-center border border-dashed border-console-border bg-console-surface p-6 text-center">
          <p className="text-[12px] text-slate-500">Belum ada pengguna.</p>
          <div className="mt-4">
            <AddUserButton onClick={() => setCreateOpen(true)} />
          </div>
        </div>
      ) : (
        <section className="border border-console-border bg-console-surface">
          <div className="flex flex-col gap-2 border-b border-console-border bg-console-surface p-3.5 lg:flex-row lg:items-center">
            <div className="flex h-8 min-w-0 flex-1 items-center gap-2 border border-console-border bg-white px-2.5 text-slate-500">
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              <input
                className="min-w-0 flex-1 bg-transparent text-[12px] text-console-ink outline-none placeholder:text-slate-400"
                placeholder="Cari nama, username, atau email..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <select
              className="h-8 border border-console-border bg-white px-2 text-[12px] text-console-ink outline-none focus:border-console-ink"
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(event.target.value as RoleCode | "")
              }
            >
              <option value="">Semua Role</option>
              <option value="FO">FO</option>
              <option value="HK">HK</option>
              <option value="FB">FB</option>
              <option value="ACC">ACC</option>
              <option value="ADMIN">ADMIN</option>
            </select>
            <select
              className="h-8 border border-console-border bg-white px-2 text-[12px] text-console-ink outline-none focus:border-console-ink"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "active" | "inactive" | "")
              }
            >
              <option value="">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 lg:ml-auto">
              <span className="num">{filteredUsers.length}</span> pengguna
            </span>
          </div>
          <div className="overflow-auto">
            <Table className="min-w-[860px] border-collapse text-[12px]">
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent"
                    aria-sort={
                      nameSort === "asc"
                        ? "ascending"
                        : nameSort === "desc"
                          ? "descending"
                          : "none"
                    }
                  >
                    <button
                      type="button"
                      className="flex h-5 items-center gap-1.5 uppercase tracking-[0.08em] text-console-accent hover:text-white"
                      onClick={toggleNameSort}
                      aria-label="Sort users by name"
                    >
                      Nama
                      {nameSort === "asc" ? (
                        <ArrowUp className="h-3 w-3" aria-hidden="true" />
                      ) : nameSort === "desc" ? (
                        <ArrowDown className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                    Username
                  </TableHead>
                  <TableHead className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                    Email
                  </TableHead>
                  <TableHead className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                    Role
                  </TableHead>
                  <TableHead className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                    Status
                  </TableHead>
                  <TableHead className="w-16 bg-console-ink px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedUsers.map((user) => (
                  <TableRow
                    key={user.id}
                    className="odd:bg-console-surface even:bg-console-bg hover:bg-status-vc-bg"
                  >
                    <TableCell className="border-b border-console-border-soft px-3 py-[9px]">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 items-center justify-center border border-console-border bg-slate-200 text-[10px] font-bold text-slate-700">
                          {userInitials(user.fullName)}
                        </span>
                        <span className="font-semibold text-console-ink">
                          {user.fullName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="border-b border-console-border-soft px-3 py-[9px] font-mono text-[12px] font-medium">
                      {user.username}
                    </TableCell>
                    <TableCell className="border-b border-console-border-soft px-3 py-[9px] text-slate-500">
                      {user.email ?? "-"}
                    </TableCell>
                    <TableCell className="border-b border-console-border-soft px-3 py-[9px]">
                      <RoleBadge role={user.role} />
                    </TableCell>
                    <TableCell className="border-b border-console-border-soft px-3 py-[9px]">
                      <ActiveBadge isActive={user.isActive} />
                    </TableCell>
                    <TableCell className="border-b border-console-border-soft px-3 py-[9px] text-right">
                      <UserRowActions
                        user={user}
                        onDelete={setDeletingUser}
                        onEdit={setEditingUser}
                        onResetPassword={setResettingUser}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {displayedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="border-b border-console-border-soft px-3 py-10 text-center text-[12px] text-slate-500"
                    >
                      Tidak ada pengguna yang cocok dengan filter.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-none border border-console-border bg-console-surface p-0 text-console-ink sm:max-w-lg">
          <DialogHeader className="bg-console-ink px-3.5 py-3">
            <DialogTitle className="text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
              {"// Tambah Pengguna"}
            </DialogTitle>
            <DialogDescription className="text-[11px] text-slate-400">
              Buat akun pengguna dan tetapkan satu role modul.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3.5">
            <UserForm
              onCancel={() => setCreateOpen(false)}
              onSaved={() => setCreateOpen(false)}
            />
          </div>
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
        <DialogContent className="rounded-none border border-console-border bg-console-surface p-0 text-console-ink sm:max-w-lg">
          <DialogHeader className="bg-console-ink px-3.5 py-3">
            <DialogTitle className="text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
              {"// Edit Pengguna"}
            </DialogTitle>
            <DialogDescription className="text-[11px] text-slate-400">
              Perbarui detail akun dan role yang ditetapkan.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3.5">
            {editingUser ? (
              <UserForm
                defaultValues={editingUser}
                onCancel={() => setEditingUser(null)}
                onSaved={() => setEditingUser(null)}
              />
            ) : null}
          </div>
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
        <DialogContent className="rounded-none border border-console-border bg-console-surface p-0 text-console-ink sm:max-w-md">
          <DialogHeader className="bg-console-ink px-3.5 py-3">
            <DialogTitle className="text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
              {"// Reset Password"}
            </DialogTitle>
            <DialogDescription className="text-[11px] text-slate-400">
              Atur password baru untuk{" "}
              {resettingUser?.username ?? "pengguna ini"}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4 p-3.5">
            <div className="space-y-2">
              <Label
                htmlFor="new-password"
                className="text-[10px] font-semibold uppercase tracking-[0.06em]"
              >
                Password Baru
              </Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Minimum 6 characters"
                className="h-8 rounded-none border-console-border bg-console-surface text-[12px]"
              />
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-console-border pt-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isResetting}
                className={buttonClassName}
                onClick={closeResetDialog}
              >
                Batal
              </Button>
              <Button
                type="submit"
                className={primaryButtonClassName}
                disabled={isResetting}
              >
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
        <AlertDialogContent className="rounded-none border-console-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus pengguna?</AlertDialogTitle>
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
