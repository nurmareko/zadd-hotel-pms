import { notFound } from "next/navigation";

import { GuestFolioView } from "./folio-view";

export const dynamic = "force-dynamic";

type GuestFolioPageProps = {
  params: Promise<{ id: string }>;
};

export default async function GuestFolioPage({
  params,
}: GuestFolioPageProps) {
  const { id } = await params;
  const folioId = Number(id);

  if (!Number.isInteger(folioId) || folioId <= 0) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-4 text-slate-900 md:px-6 md:py-5">
      <GuestFolioView folioId={folioId} />
    </main>
  );
}
