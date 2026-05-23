import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

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

  const latestAudit = await prisma.nightAudit.findFirst({
    orderBy: { businessDate: "desc" },
    select: { id: true },
  });

  if (!latestAudit) {
    notFound();
  }

  redirect(`/app/acc/reports/${latestAudit.id}`);
}
