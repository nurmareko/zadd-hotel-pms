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
import { deleteMenuItem } from "./actions";
import { MenuForm } from "./menu-form";
import { MenuItemActions } from "./menu-item-actions";

export type MenuItemRow = {
  id: number;
  code: string;
  name: string;
  category: string;
  price: string;
  isActive: boolean;
};

type MenuTableProps = {
  items: MenuItemRow[];
};

function AddMenuItemButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" onClick={onClick}>
      <Plus aria-hidden="true" />
      Add Menu Item
    </Button>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={[
        "inline-flex h-6 items-center rounded-md px-2 text-xs font-medium",
        isActive
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          : "bg-muted text-muted-foreground ring-1 ring-border",
      ].join(" ")}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

export function MenuTable({ items }: MenuTableProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItemRow | null>(null);
  const [deletingItem, setDeletingItem] = useState<MenuItemRow | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  function handleDelete() {
    if (!deletingItem) {
      return;
    }

    startDeleteTransition(async () => {
      const result = await deleteMenuItem(deletingItem.id);

      if (result.ok) {
        toast.success("Menu item deleted");
        setDeletingItem(null);
        return;
      }

      toast.error(result.error);
    });
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            F&amp;B Menu Items
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage menu items for Hotel Restaurant.
          </p>
        </div>
        {items.length > 0 ? (
          <AddMenuItemButton onClick={() => setCreateOpen(true)} />
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="mt-8 flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Belum ada menu item.
          </p>
          <div className="mt-4">
            <AddMenuItemButton onClick={() => setCreateOpen(true)} />
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs font-medium">
                    {item.code}
                  </TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatIDR(item.price)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge isActive={item.isActive} />
                  </TableCell>
                  <TableCell className="text-right">
                    <MenuItemActions
                      item={item}
                      onDelete={setDeletingItem}
                      onEdit={setEditingItem}
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
            <DialogTitle>Add Menu Item</DialogTitle>
            <DialogDescription>
              Create a menu item for the F&amp;B order flow.
            </DialogDescription>
          </DialogHeader>
          <MenuForm
            onCancel={() => setCreateOpen(false)}
            onSaved={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingItem)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingItem(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Menu Item</DialogTitle>
            <DialogDescription>
              Update the menu item details shown to F&amp;B users.
            </DialogDescription>
          </DialogHeader>
          {editingItem ? (
            <MenuForm
              defaultValues={{
                id: editingItem.id,
                code: editingItem.code,
                name: editingItem.name,
                category: editingItem.category,
                price: Number(editingItem.price),
              }}
              onCancel={() => setEditingItem(null)}
              onSaved={() => setEditingItem(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deletingItem)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingItem(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete menu item?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {deletingItem?.name ?? "this menu item"} from the
              F&amp;B menu. This action cannot be undone.
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
