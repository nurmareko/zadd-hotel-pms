import { prisma } from "@/lib/prisma";
import { SettingsForm } from "./settings-form";

export default async function HotelSettingsPage() {
  const settings = await prisma.hotelSettings.findUniqueOrThrow({
    where: { id: 1 },
    select: {
      hotelName: true,
      address: true,
      taxPercent: true,
      serviceChargePercent: true,
      nightAuditTime: true,
      currency: true,
    },
  });

  return (
    <main className="p-4 sm:p-6">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          Hotel Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update tax, service charge, and hotel profile settings.
        </p>

        <div className="mt-6 rounded-lg border p-4">
          <SettingsForm
            defaultValues={{
              hotelName: settings.hotelName,
              address: settings.address ?? "",
              taxPercent: Number(settings.taxPercent),
              serviceChargePercent: Number(settings.serviceChargePercent),
              nightAuditTime: settings.nightAuditTime,
              currency: settings.currency,
            }}
          />
        </div>
      </div>
    </main>
  );
}
