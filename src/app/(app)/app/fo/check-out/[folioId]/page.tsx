export default async function CheckOutPage({
  params,
}: {
  params: Promise<{ folioId: string }>;
}) {
  const { folioId } = await params;

  return (
    <main className="p-6">
      <div>
        <h1 className="text-2xl font-semibold">Check-out — placeholder</h1>
        <p className="text-sm text-muted-foreground mt-2 font-mono">
          folioId={folioId}
        </p>
      </div>
    </main>
  );
}
