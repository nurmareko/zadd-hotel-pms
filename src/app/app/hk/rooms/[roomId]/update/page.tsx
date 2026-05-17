export default async function HkUpdateStatusPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;

  return (
    <main className="p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          HK Update Status — placeholder
        </h1>
        <p className="text-sm text-muted-foreground mt-2 font-mono">
          roomId={roomId}
        </p>
      </div>
    </main>
  );
}
