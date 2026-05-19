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
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4">
        <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
          <span className="text-console-accent">▸ </span>
          Pengaturan Hotel
        </h1>
        <p className="mt-1 text-[11px] leading-5 text-slate-500">
          Konfigurasi hotel, pajak, service charge, dan cut-off Night Audit.
        </p>
      </div>

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
    </main>
  );
}
