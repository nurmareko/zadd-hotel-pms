import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { normalizeGuestQuery } from "@/lib/guests/filters";
import { findGuests } from "@/lib/guests/queries";
import { GuestFilters } from "./guest-filters";
import { GuestTable } from "./guest-table";

export const dynamic = "force-dynamic";

export default async function GuestDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["FO", "ADMIN"].includes(session.user.role)) redirect("/app/forbidden");

  const q = normalizeGuestQuery((await searchParams).q);
  const guests = await findGuests(q);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Daftar Tamu</h1>
        <p className="mt-1 text-sm text-slate-500">Cari data tamu dan gunakan kembali untuk reservasi baru.</p>
      </header>
      <section aria-label="Direktori tamu" className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <GuestFilters q={q} resultCount={guests.length} />
        <GuestTable guests={guests} q={q} />
      </section>
    </div>
  );
}
