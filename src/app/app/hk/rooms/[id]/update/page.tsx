export default async function HkUpdateStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          HK Update Status — placeholder
        </h1>
        <p className="text-sm text-muted-foreground mt-2 font-mono">
          roomId={id}
        </p>
      </div>
    </main>
  );
}
