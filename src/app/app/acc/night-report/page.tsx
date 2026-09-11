import { redirect } from "next/navigation";

import {
  getManagerFlashReport,
  resolveManagerFlashDate,
} from "@/lib/manager-flash";

import { ManagerFlashView } from "../manager-flash-view";

export const dynamic = "force-dynamic";

type NightReportPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NightReportPage({
  searchParams,
}: NightReportPageProps) {
  const params = (await searchParams) ?? {};
  const auditId = firstParam(params.auditId);

  if (auditId) {
    redirect(`/app/acc/reports/${auditId}`);
  }

  const selectedDate = resolveManagerFlashDate(firstParam(params.date));
  const report = await getManagerFlashReport(selectedDate);

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-4 text-foreground md:px-6 md:py-5">
      <ManagerFlashView report={report} />
    </main>
  );
}
