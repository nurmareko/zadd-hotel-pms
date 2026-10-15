import { prisma } from "@/lib/prisma";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

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
    <main className="min-h-screen bg-slate-50 px-5 py-4 text-foreground md:px-6 md:py-5">
      <div className="mb-4">
        <Breadcrumb className="mb-2">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/app/admin">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Settings</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Hotel Settings
        </h1>
        <p className="mt-1 text-sm leading-5 text-slate-500">
          Configure hotel details, tax, service charge and the Night Audit cut-off time.
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
