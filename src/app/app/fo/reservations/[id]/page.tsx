export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Reservation Form (edit/view) — placeholder
        </h1>
        <p className="text-sm text-muted-foreground mt-2 font-mono">id={id}</p>
      </div>
    </main>
  );
}
