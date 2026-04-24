export default async function CheckInPage({
  params,
}: {
  params: Promise<{ reservationId: string }>;
}) {
  const { reservationId } = await params;

  return (
    <main className="p-6">
      <div>
        <h1 className="text-2xl font-semibold">Check-in — placeholder</h1>
        <p className="text-sm text-muted-foreground mt-2 font-mono">
          reservationId={reservationId}
        </p>
      </div>
    </main>
  );
}
