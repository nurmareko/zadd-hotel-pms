import Link from "next/link";

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

  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
            <span className="text-console-accent">▸ </span>
            Night Report
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            AC-03 placeholder{auditId ? ` · Audit #${auditId}` : ""}
          </p>
        </div>
        <Link
          className="inline-flex h-8 items-center justify-center border border-console-border bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
          href="/app/acc"
        >
          Kembali
        </Link>
      </div>

      <section className="border border-console-border bg-console-surface">
        <div className="border-b border-console-border bg-console-ink px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
          {"// AC-03"}
        </div>
        <div className="p-8 text-center text-[12px] leading-5 text-slate-500">
          Night Report dan export PDF akan dibangun pada sesi AC-03.
        </div>
      </section>
    </main>
  );
}
