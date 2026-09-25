import { type Prisma } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { activityHref, activityLabels, parseActivityQuery, type ActivityQuery } from "./activity-log-display";
import { ActivityLogTable } from "./activity-log-table";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

export default async function ActivityLogPage({ searchParams }: { searchParams: Promise<ActivityQuery> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN" || !can(session.user.role, "activity_log:read")) {
    redirect("/app/forbidden");
  }

  const filters = parseActivityQuery(await searchParams);
  const where: Prisma.ActivityLogWhereInput = {
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.userId ? { userId: filters.userId } : {}),
  };
  const [total, users] = await Promise.all([
    prisma.activityLog.count({ where }),
    prisma.user.findMany({
      select: { id: true, fullName: true, username: true },
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const activities = await prisma.activityLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      user: { select: { id: true, fullName: true, username: true } },
      reservation: { select: { id: true, reservationNo: true, guest: { select: { fullName: true } } } },
      room: { select: { id: true, number: true } },
      folio: { select: { id: true, folioNo: true, reservationId: true } },
    },
  });
  const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <main className="min-h-screen space-y-4 bg-slate-50 p-4 text-foreground md:p-5 lg:space-y-6 lg:p-6">
      <header>
        <h1 className="text-3xl font-bold">Log Aktivitas</h1>
        <p className="mt-2 text-sm text-muted-foreground">Riwayat aktivitas pengguna pada reservasi, kamar, dan folio. Waktu ditampilkan dalam WIB.</p>
      </header>
      <form action="/app/admin/activity-log" method="get" className="flex flex-col gap-4 rounded-lg border bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end lg:p-5">
        <div className="min-w-0 sm:w-64">
          <label htmlFor="activity-action" className="mb-2 block text-sm font-medium">Aksi</label>
          <select key={filters.action ?? "all"} id="activity-action" name="action" defaultValue={filters.action ?? ""} className={selectClass}>
            <option value="">Semua aksi</option>
            {Object.entries(activityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="min-w-0 sm:w-72">
          <label htmlFor="activity-user" className="mb-2 block text-sm font-medium">Pengguna</label>
          <select key={filters.userId ?? "all"} id="activity-user" name="userId" defaultValue={filters.userId ?? ""} className={selectClass}>
            <option value="">Semua pengguna</option>
            {filters.userId && !users.some((user) => user.id === filters.userId) && <option value={filters.userId}>Pengguna tidak ditemukan</option>}
            {users.map((user) => <option key={user.id} value={user.id}>{user.fullName} (@{user.username})</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">Terapkan Filter</Button>
          <Link href="/app/admin/activity-log" className={buttonVariants({ variant: "outline" })}>Reset Filter</Link>
        </div>
      </form>
      <section aria-label="Riwayat aktivitas" className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="border-b px-4 py-3 text-sm text-muted-foreground"><span className="font-semibold tabular-nums text-foreground">{total.toLocaleString("id-ID")}</span> aktivitas ditemukan</div>
        <ActivityLogTable activities={activities} filtered={Boolean(filters.action || filters.userId)} />
        <nav aria-label="Halaman log aktivitas" className="flex flex-wrap items-center justify-between gap-3 border-t p-4">
          <p className="text-sm tabular-nums text-muted-foreground">Halaman {page} dari {totalPages}</p>
          <div className="flex gap-2">
            {page > 1 ? <Link href={activityHref(filters, page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>Sebelumnya</Link> : <Button variant="outline" size="sm" disabled>Sebelumnya</Button>}
            {page < totalPages ? <Link href={activityHref(filters, page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>Berikutnya</Link> : <Button variant="outline" size="sm" disabled>Berikutnya</Button>}
          </div>
        </nav>
      </section>
    </main>
  );
}
