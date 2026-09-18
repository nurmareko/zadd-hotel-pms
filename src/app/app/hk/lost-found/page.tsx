import { Prisma, type LostFoundStatus } from "@prisma/client";
import { Archive, CheckCircle2, ClipboardList, Trash2 } from "lucide-react";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { auth } from "@/auth";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { formatCompactDateTimeID } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { canAccessLostFound } from "@/lib/lost-found/access";
import { buildLostFoundWhere, parseLostFoundFilters, type LostFoundFilters as FilterValues } from "@/lib/lost-found/filters";
import { LOST_FOUND_CATEGORY_ICONS, LOST_FOUND_CATEGORY_LABELS, LOST_FOUND_STATUS_LABELS, LOST_FOUND_STATUS_STYLES } from "@/lib/lost-found/labels";
import { ClaimLostFoundDialog, CreateLostFoundDialog, DisposeLostFoundDialog } from "./lost-found-dialogs";
import { LostFoundFilters } from "./lost-found-filters";

export const dynamic = "force-dynamic";

const itemSelect = {
  id: true, referenceCode: true, description: true, category: true, status: true,
  locationDetails: true, createdAt: true, claimantName: true, claimantPhone: true,
  returnedAt: true, resolution: true, disposedAt: true, disposalReason: true,
  room: { select: { number: true } }, foundBy: { select: { fullName: true } },
  returnedBy: { select: { fullName: true } }, disposedBy: { select: { fullName: true } },
} satisfies Prisma.LostFoundItemSelect;
type Item = Prisma.LostFoundItemGetPayload<{ select: typeof itemSelect }>;

function ItemStatus({ status }: { status: LostFoundStatus }) {
  const style = LOST_FOUND_STATUS_STYLES[status];
  return <StatusBadge label={LOST_FOUND_STATUS_LABELS[status]} className={style.badge} pipClassName={style.pip} size="md" />;
}

function ItemLocation({ item }: { item: Item }) {
  return <div className="space-y-1"><p className="whitespace-pre-wrap break-words font-medium">{item.description}</p><p className="break-words text-xs text-muted-foreground">{item.room ? `Kamar ${item.room.number}` : "Area Publik"}{item.locationDetails ? ` · ${item.locationDetails}` : ""}</p></div>;
}

function ItemCategory({ item }: { item: Item }) {
  const Icon = LOST_FOUND_CATEGORY_ICONS[item.category];
  return <span className="inline-flex items-center gap-2 text-xs"><Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />{LOST_FOUND_CATEGORY_LABELS[item.category]}</span>;
}

function ItemResolution({ item, now }: { item: Item; now: number }) {
  if (item.status === "UNCLAIMED") {
    const identity = { id: item.id, referenceCode: item.referenceCode, description: item.description };
    return <div className="flex flex-wrap gap-2"><ClaimLostFoundDialog item={identity} /><DisposeLostFoundDialog item={identity} daysElapsed={Math.max(0, Math.floor((now - item.createdAt.getTime()) / 86400000))} /></div>;
  }
  const returned = item.status === "RETURNED";
  const date = returned ? item.returnedAt : item.disposedAt;
  const operator = returned ? item.returnedBy : item.disposedBy;
  return <div className="space-y-1 rounded-md border bg-muted/40 p-3 text-xs">
    <p className="break-words font-semibold">{returned ? item.claimantName ?? "Data pengambil belum tercatat" : item.disposalReason ?? "Alasan belum tercatat"}</p>
    {returned && item.claimantPhone && <p className="break-words">{item.claimantPhone}</p>}
    {returned && item.resolution && <p className="whitespace-pre-wrap break-words text-muted-foreground">{item.resolution}</p>}
    <p className="text-muted-foreground">{date ? formatCompactDateTimeID(date) : "Waktu belum tercatat"}</p>
    <p className="text-muted-foreground">Oleh: {operator?.fullName ?? "Petugas belum tercatat"}</p>
  </div>;
}

export default async function LostFoundPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!(await canAccessLostFound(session.user))) return <main className="p-6"><h1 className="text-xl font-semibold">Akses Ditolak</h1><p>Anda tidak memiliki akses ke daftar barang temuan.</p></main>;
  let filters: FilterValues = {};
  let filterError: string | null = null;
  try { filters = parseLostFoundFilters(await searchParams); } catch (error) {
    if (!(error instanceof ZodError)) throw error;
    const issue = error.issues[0];
    filterError = (issue?.code === "invalid_union" ? issue.errors[0]?.[0]?.message : issue?.message) ?? "Filter tidak valid.";
  }
  const [items, rooms, counts] = await Promise.all([
    filterError ? Promise.resolve([]) : prisma.lostFoundItem.findMany({ where: buildLostFoundWhere(filters), orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: itemSelect }),
    prisma.room.findMany({ orderBy: [{ floor: "asc" }, { number: "asc" }], select: { id: true, number: true } }),
    prisma.lostFoundItem.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const count = (status: LostFoundStatus) => counts.find((row) => row.status === status)?._count._all ?? 0;
  const metrics = [
    { label: "Disimpan", hint: "Menunggu Klaim", value: count("UNCLAIMED"), icon: Archive },
    { label: "Dikembalikan", hint: "Telah diserahkan ke tamu", value: count("RETURNED"), icon: CheckCircle2 },
    { label: "Dimusnahkan / Dihibahkan", hint: "Penyelesaian sesuai kebijakan", value: count("DISPOSED"), icon: Trash2 },
    { label: "Total Register", hint: "Seluruh barang tercatat", value: counts.reduce((sum, row) => sum + row._count._all, 0), icon: ClipboardList },
  ];
  // This dynamic server page captures one request-time clock for every disposal preview.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  return <main className="space-y-6 p-4 text-foreground md:p-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-bold tracking-tight">Barang Temuan</h1><p className="mt-1 text-sm text-muted-foreground">Pencatatan, penyimpanan, dan penyelesaian barang temuan hotel.</p></div><CreateLostFoundDialog rooms={rooms} /></header>
    <section aria-label="Ringkasan seluruh barang temuan" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(({ label, hint, value, icon: Icon }) => <Card className="gap-2 p-4" key={label}><div className="flex items-start justify-between gap-3"><h2 className="text-sm font-medium">{label}</h2><Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" /></div><p className="text-3xl font-bold tabular-nums">{value}</p><p className="text-xs text-muted-foreground">{hint}</p></Card>)}</section>
    <Card className="gap-0 overflow-hidden p-0">
      <LostFoundFilters key={JSON.stringify(filters)} filters={filters} canExport={!filterError} />
      {filterError && <p role="alert" className="m-4 rounded-md border border-destructive/30 p-3 text-sm text-destructive">{filterError} Atur ulang filter untuk menampilkan daftar.</p>}
      <div className="border-b px-4 py-3 text-sm text-muted-foreground">{items.length} barang sesuai filter · terbaru dahulu</div>
      {items.length === 0 ? <div className="space-y-2 p-8 text-center"><Archive className="mx-auto size-8 text-muted-foreground" aria-hidden="true" /><h2 className="font-semibold">Tidak ada barang yang ditampilkan</h2><p className="text-sm text-muted-foreground">Sesuaikan filter atau catat barang temuan baru.</p></div> : <>
        <div className="hidden overflow-x-auto desktop:block"><table className="w-full min-w-[1100px] text-sm"><caption className="sr-only">Daftar barang temuan dan riwayat penyelesaiannya</caption><thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground"><tr>{["Kode & Waktu", "Barang & Lokasi", "Kategori", "Ditemukan Oleh", "Status", "Aksi / Penyelesaian"].map((label) => <th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20"><td className="px-4 py-3 align-top"><p className="font-semibold">{item.referenceCode}</p><p className="mt-1 text-xs text-muted-foreground">{formatCompactDateTimeID(item.createdAt)}</p></td><td className="px-4 py-3 align-top"><ItemLocation item={item} /></td><td className="px-4 py-3 align-top"><ItemCategory item={item} /></td><td className="break-words px-4 py-3 align-top">{item.foundBy.fullName}</td><td className="px-4 py-3 align-top"><ItemStatus status={item.status} /></td><td className="px-4 py-3 align-top"><ItemResolution item={item} now={now} /></td></tr>)}</tbody></table></div>
        <div className="divide-y desktop:hidden">{items.map((item) => <article key={item.id} className="space-y-4 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-sm font-semibold">{item.referenceCode}</h2><p className="mt-1 text-xs text-muted-foreground">{formatCompactDateTimeID(item.createdAt)}</p></div><ItemStatus status={item.status} /></div><ItemLocation item={item} /><ItemCategory item={item} /><p className="text-xs text-muted-foreground">Ditemukan oleh: {item.foundBy.fullName}</p><ItemResolution item={item} now={now} /></article>)}</div>
      </>}
    </Card>
  </main>;
}
