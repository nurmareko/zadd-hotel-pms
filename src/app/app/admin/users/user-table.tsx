"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Plus,
  Search,
  SearchX,
  Users,
} from "lucide-react";
import { FormEvent, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

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
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
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


const roleClassNames: Record<RoleCode, string> = {
  FO: "border-blue-500 bg-status-oc-bg text-status-oc-fg",
  HK: "border-amber-500 bg-status-vd-bg text-status-vd-fg",
  FB: "border-emerald-500 bg-status-vc-bg text-status-vc-fg",
  ACC: "border-slate-500 bg-status-ooo-bg text-status-ooo-fg",
  ADMIN: "border-red-500 bg-status-od-bg text-status-od-fg",
};

function AddUserButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" onClick={onClick}>
      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      Tambah Pengguna
    </Button>
  );
}

function RoleBadge({ role }: { role: RoleCode }) {
  return (
    <StatusBadge label={role} className={roleClassNames[role]} showPip={false} />
  );
}

function ActiveBadge({ isActive }: { isActive: boolean }) {
  const className = isActive
    ? "border-status-vc-pip bg-status-vc-bg text-status-vc-fg"
    : "border-status-ooo-pip bg-status-ooo-bg text-status-ooo-fg";

  return (
    <StatusBadge
      label={isActive ? "Aktif" : "Nonaktif"}
      className={className}
      showPip={false}
    />
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
        toast.success("Pengguna dihapus");
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
        toast.success("Password direset");
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
      <div className="mb-4">
        <Breadcrumb className="mb-2">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/app/admin">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Pengguna</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Pengguna
            </h1>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              Kelola akun praktikum dan penetapan role.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <AddUserButton onClick={() => setCreateOpen(true)} />
          </div>
        </div>
      </div>

      {users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Belum ada pengguna"
          description="Tambahkan akun untuk role operasional dan admin."
          action={<AddUserButton onClick={() => setCreateOpen(true)} />}
          className="mt-8 min-h-56 bg-card"
        />
      ) : (
        <section className="rounded-lg border border-border bg-card">
          <div className="flex flex-col gap-2 border-b border-border bg-card p-3.5 lg:flex-row lg:items-center">
            <div className="flex h-11 desktop:h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors">
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-slate-400"
                placeholder="Cari nama, username, atau email..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <select
              className="h-11 desktop:h-10 border border-border bg-white px-2 text-sm text-foreground outline-none focus:border-primary"
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
              className="h-11 desktop:h-10 border border-border bg-white px-2 text-sm text-foreground outline-none focus:border-primary"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "active" | "inactive" | "")
              }
            >
              <option value="">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
            <span className="text-sm font-semibold uppercase tracking-[0.06em] text-slate-500 lg:ml-auto">
              <span className="num">{filteredUsers.length}</span> pengguna
            </span>
          </div>
          <div className="overflow-auto">
            <Table className="min-w-[860px] border-collapse text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="bg-card px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground text-primary"
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
                      className="flex h-5 items-center gap-1.5 uppercase tracking-[0.08em] text-primary hover:text-white"
                      onClick={toggleNameSort}
                      aria-label="Urutkan pengguna berdasarkan nama"
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
                  <TableHead className="bg-card px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground text-primary">
                    Username
                  </TableHead>
                  <TableHead className="bg-card px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground text-primary">
                    Email
                  </TableHead>
                  <TableHead className="bg-card px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground text-primary">
                    Role
                  </TableHead>
                  <TableHead className="bg-card px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground text-primary">
                    Status
                  </TableHead>
                  <TableHead className="w-16 bg-card px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground text-primary">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedUsers.map((user) => (
                  <TableRow
                    key={user.id}
                    className="odd:bg-card even:bg-slate-50 hover:bg-status-vc-bg"
                  >
                    <TableCell className="border-b border-border/60 px-3 py-[9px]">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 items-center justify-center border border-border bg-slate-200 text-[10px] font-bold text-slate-700">
                          {userInitials(user.fullName)}
                        </span>
                        <span className="font-semibold text-foreground">
                          {user.fullName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="border-b border-border/60 px-3 py-[9px] font-medium text-sm font-medium">
                      {user.username}
                    </TableCell>
                    <TableCell className="border-b border-border/60 px-3 py-[9px] text-slate-500">
                      {user.email ?? "-"}
                    </TableCell>
                    <TableCell className="border-b border-border/60 px-3 py-[9px]">
                      <RoleBadge role={user.role} />
                    </TableCell>
                    <TableCell className="border-b border-border/60 px-3 py-[9px]">
                      <ActiveBadge isActive={user.isActive} />
                    </TableCell>
                    <TableCell className="border-b border-border/60 px-3 py-[9px] text-right">
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
                      className="border-b border-border/60 px-3 py-3"
                    >
                      <EmptyState
                        icon={SearchX}
                        title="Tidak ada pengguna"
                        description="Tidak ada pengguna yang cocok dengan filter."
                      />
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-xl border border-border bg-card p-0 text-foreground sm:max-w-lg">
          <DialogHeader className="bg-slate-50 border-b border-border px-3.5 py-3 rounded-t-xl">
            <DialogTitle className="text-sm font-bold uppercase tracking-[0.08em] text-primary">
              {"Tambah Pengguna"}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-400">
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
        <DialogContent className="rounded-xl border border-border bg-card p-0 text-foreground sm:max-w-lg">
          <DialogHeader className="bg-slate-50 border-b border-border px-3.5 py-3 rounded-t-xl">
            <DialogTitle className="text-sm font-bold uppercase tracking-[0.08em] text-primary">
              {"Edit Pengguna"}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-400">
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
        <DialogContent className="rounded-xl border border-border bg-card p-0 text-foreground sm:max-w-md">
          <DialogHeader className="bg-slate-50 border-b border-border px-3.5 py-3 rounded-t-xl">
            <DialogTitle className="text-sm font-bold uppercase tracking-[0.08em] text-primary">
              {"Reset Password"}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-400">
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
                placeholder="Minimal 6 karakter"
                className="h-11 desktop:h-10 rounded-none border-border bg-card text-sm"
              />
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isResetting}
                onClick={closeResetDialog}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={isResetting}
              >
              {isResetting ? "Menyimpan..." : "Reset Password"}
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
        <AlertDialogContent className="rounded-xl border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus pengguna?</AlertDialogTitle>
            <AlertDialogDescription>
              Menghapus {deletingUser?.username ?? "pengguna ini"} dari
              sistem. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
