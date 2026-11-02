import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { can } from "@/lib/permissions";
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
  if (!can(session.user.role, "reservations:read")) redirect("/app/forbidden");

  const q = normalizeGuestQuery((await searchParams).q);
  const guests = await findGuests(q);

  return (
    <main className="min-w-0 space-y-4 p-4 text-slate-900 sm:p-5 desktop:space-y-6 desktop:p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-[32px] sm:leading-tight">Guests</h1>
        <p className="mt-1 text-sm text-slate-500">Find guest records and reuse them for new reservations.</p>
      </header>
      <section aria-label="Guest directory" className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <GuestFilters q={q} resultCount={guests.length} />
        <GuestTable guests={guests} q={q} />
      </section>
    </main>
  );
}
