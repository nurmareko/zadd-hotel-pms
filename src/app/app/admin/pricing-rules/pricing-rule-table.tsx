"use client";

import {
  PricingRuleAdjustmentKind,
  PricingRuleDayOfWeek,
  PricingRuleSelectorKind,
} from "@prisma/client";
import {
  CalendarRange,
  CalendarSync,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Search,
  SearchX,
  Trash2,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/status-badge";
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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDecimalID, formatIDR } from "@/lib/format";
import {
  deletePricingRule,
  togglePricingRule,
} from "./actions";
import {
  PricingRuleForm,
  type PricingRoomTypeOption,
} from "./pricing-rule-form";

export type PricingRuleRow = {
  id: string;
  name: string;
  roomTypeId: number;
  roomTypeCode: string;
  roomTypeName: string;
  selectorKind: PricingRuleSelectorKind;
  dayOfWeek: PricingRuleDayOfWeek | null;
  startsOn: string | null;
  endsBefore: string | null;
  adjustmentKind: PricingRuleAdjustmentKind;
  adjustmentValue: string;
  isActive: boolean;
};

type PricingRuleTableProps = {
  rules: PricingRuleRow[];
  roomTypes: PricingRoomTypeOption[];
};

const dayLabels: Record<PricingRuleDayOfWeek, string> = {
  MONDAY: "Senin",
  TUESDAY: "Selasa",
  WEDNESDAY: "Rabu",
  THURSDAY: "Kamis",
  FRIDAY: "Jumat",
  SATURDAY: "Sabtu",
  SUNDAY: "Minggu",
};

function formatRuleDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function selectorDescription(rule: PricingRuleRow) {
  if (
    rule.selectorKind === PricingRuleSelectorKind.DAY_OF_WEEK &&
    rule.dayOfWeek
  ) {
    return dayLabels[rule.dayOfWeek];
  }

  if (rule.startsOn && rule.endsBefore) {
    return `${formatRuleDate(rule.startsOn)} – sebelum ${formatRuleDate(rule.endsBefore)}`;
  }

  return "Selector tidak lengkap";
}

function adjustmentDescription(rule: PricingRuleRow) {
  const value = Number(rule.adjustmentValue);
  const sign = value > 0 ? "+" : "";

  if (rule.adjustmentKind === PricingRuleAdjustmentKind.AMOUNT_DELTA) {
    return `${sign}${formatIDR(value)}`;
  }

  return `${sign}${formatDecimalID(value)}%`;
}

function AddRuleButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" onClick={onClick}>
      <Plus aria-hidden="true" />
      Tambah aturan
    </Button>
  );
}

function RuleActions({
  rule,
  isToggling,
  onDelete,
  onEdit,
  onToggle,
}: {
  rule: PricingRuleRow;
  isToggling: boolean;
  onDelete: (rule: PricingRuleRow) => void;
  onEdit: (rule: PricingRuleRow) => void;
  onToggle: (rule: PricingRuleRow) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Aksi untuk ${rule.name}`}
          />
        }
      >
        <MoreHorizontal aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => onEdit(rule)}>
          <Pencil aria-hidden="true" />
          Edit aturan
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isToggling} onClick={() => onToggle(rule)}>
          <Power aria-hidden="true" />
          {rule.isActive ? "Nonaktifkan" : "Aktifkan"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(rule)}>
          <Trash2 aria-hidden="true" />
          Hapus aturan
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PricingRuleTable({ rules, roomTypes }: PricingRuleTableProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRuleRow | null>(null);
  const [deletingRule, setDeletingRule] = useState<PricingRuleRow | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">(
    "",
  );
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isToggling, startToggleTransition] = useTransition();
  const filteredRules = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rules.filter((rule) => {
      const matchesQuery =
        !normalizedQuery ||
        rule.name.toLowerCase().includes(normalizedQuery) ||
        rule.roomTypeCode.toLowerCase().includes(normalizedQuery) ||
        rule.roomTypeName.toLowerCase().includes(normalizedQuery);
      const matchesStatus =
        !statusFilter ||
        (statusFilter === "active" ? rule.isActive : !rule.isActive);

      return matchesQuery && matchesStatus;
    });
  }, [query, rules, statusFilter]);

  function handleToggle(rule: PricingRuleRow) {
    setPendingToggleId(rule.id);
    startToggleTransition(async () => {
      const result = await togglePricingRule({
        id: rule.id,
        isActive: !rule.isActive,
      });
      setPendingToggleId(null);

      if (result.ok) {
        toast.success(rule.isActive ? "Aturan dinonaktifkan" : "Aturan diaktifkan");
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete() {
    if (!deletingRule) return;

    startDeleteTransition(async () => {
      const result = await deletePricingRule(deletingRule.id);
      if (result.ok) {
        toast.success("Aturan harga dihapus");
        setDeletingRule(null);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <header className="mb-4">
        <Breadcrumb className="mb-2">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/app/admin">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Aturan harga</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Aturan harga
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-500">
              Kelola penyesuaian tarif per tipe kamar untuk hari tertentu atau
              rentang tanggal. Rentang tanggal aktif diprioritaskan saat resolver
              menemukan lebih dari satu kecocokan.
            </p>
          </div>
          <AddRuleButton onClick={() => setCreateOpen(true)} />
        </div>
      </header>

      <section className="rounded-lg border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
          <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-white px-3 shadow-sm desktop:h-10">
            <Search className="size-4 text-slate-500" aria-hidden="true" />
            <label htmlFor="pricing-rule-search" className="sr-only">
              Cari aturan harga
            </label>
            <input
              id="pricing-rule-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari aturan atau tipe kamar..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <label htmlFor="pricing-rule-status" className="sr-only">
            Filter status aturan
          </label>
          <select
            id="pricing-rule-status"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as "" | "active" | "inactive",
              )
            }
            className="h-11 rounded-md border border-input bg-white px-3 text-sm shadow-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 desktop:h-10"
          >
            <option value="">Semua status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
          <p className="text-sm font-medium text-slate-500" aria-live="polite">
            <span className="num">{filteredRules.length}</span> aturan
          </p>
        </div>

        {rules.length === 0 ? (
          <EmptyState
            icon={CalendarSync}
            title="Belum ada aturan harga"
            description="Tambahkan aturan untuk mensimulasikan penyesuaian tarif di luar tarif dasar."
            action={<AddRuleButton onClick={() => setCreateOpen(true)} />}
            className="m-4 min-h-56"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-235">
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">Nama aturan</TableHead>
                  <TableHead>Tipe kamar</TableHead>
                  <TableHead>Selector</TableHead>
                  <TableHead>Penyesuaian</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20 px-4 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="px-4 font-semibold">{rule.name}</TableCell>
                    <TableCell>
                      <p className="font-medium">{rule.roomTypeName}</p>
                      <p className="text-xs text-slate-500">{rule.roomTypeCode}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-start gap-2">
                        <CalendarRange className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
                        <div>
                          <p className="font-medium">
                            {rule.selectorKind === PricingRuleSelectorKind.DAY_OF_WEEK
                              ? "Hari mingguan"
                              : "Rentang tanggal"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {selectorDescription(rule)}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="num font-semibold">
                      {adjustmentDescription(rule)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={rule.isActive ? "Aktif" : "Nonaktif"}
                        className={
                          rule.isActive
                            ? "border-green-300 bg-green-50 text-green-700"
                            : "border-slate-300 bg-slate-100 text-slate-600"
                        }
                      />
                    </TableCell>
                    <TableCell className="px-4 text-right">
                      <RuleActions
                        rule={rule}
                        isToggling={isToggling && pendingToggleId === rule.id}
                        onDelete={setDeletingRule}
                        onEdit={setEditingRule}
                        onToggle={handleToggle}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {filteredRules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-4">
                      <EmptyState
                        icon={SearchX}
                        title="Aturan tidak ditemukan"
                        description="Ubah kata kunci atau filter status untuk melihat aturan lain."
                      />
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="gap-0 overflow-hidden rounded-xl border border-border bg-card p-0 text-foreground sm:max-w-2xl">
          <DialogHeader className="border-b border-border bg-slate-50 px-4 py-4 sm:px-5">
            <DialogTitle>Tambah aturan harga</DialogTitle>
            <DialogDescription>
              Buat satu aturan hari atau rentang tanggal untuk tipe kamar.
            </DialogDescription>
          </DialogHeader>
          <PricingRuleForm
            roomTypes={roomTypes}
            onCancelAction={() => setCreateOpen(false)}
            onSavedAction={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingRule)}
        onOpenChange={(open) => {
          if (!open) setEditingRule(null);
        }}
      >
        <DialogContent className="gap-0 overflow-hidden rounded-xl border border-border bg-card p-0 text-foreground sm:max-w-2xl">
          <DialogHeader className="border-b border-border bg-slate-50 px-4 py-4 sm:px-5">
            <DialogTitle>Edit aturan harga</DialogTitle>
            <DialogDescription>
              Perbarui selector, penyesuaian, atau status aturan.
            </DialogDescription>
          </DialogHeader>
          {editingRule ? (
            <PricingRuleForm
              roomTypes={roomTypes}
              defaultValues={{
                id: editingRule.id,
                name: editingRule.name,
                roomTypeId: editingRule.roomTypeId,
                selectorKind: editingRule.selectorKind,
                dayOfWeek: editingRule.dayOfWeek,
                startsOn: editingRule.startsOn,
                endsBefore: editingRule.endsBefore,
                adjustmentKind: editingRule.adjustmentKind,
                adjustmentValue: editingRule.adjustmentValue,
                isActive: editingRule.isActive,
              }}
              onCancelAction={() => setEditingRule(null)}
              onSavedAction={() => setEditingRule(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deletingRule)}
        onOpenChange={(open) => {
          if (!open) setDeletingRule(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus aturan harga?</AlertDialogTitle>
            <AlertDialogDescription>
              Aturan “{deletingRule?.name ?? ""}” akan dihapus permanen. Tindakan
              ini tidak dapat dibatalkan.
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
