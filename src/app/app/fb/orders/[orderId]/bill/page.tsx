import Link from "next/link";
import { notFound } from "next/navigation";

import { formatIDR } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type BillPlaceholderPageProps = {
  params: Promise<{ orderId: string }>;
};

export default async function BillPlaceholderPage({
  params,
}: BillPlaceholderPageProps) {
  const { orderId } = await params;
  const order = await prisma.fBOrder.findUnique({
    where: { id: Number(orderId) || -1 },
    select: {
      id: true,
      orderNo: true,
      total: true,
      table: { select: { number: true } },
    },
  });

  if (!order) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
            <span className="text-console-accent">▸ </span>
            Bill Detail
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            Placeholder FB-03 · {order.orderNo} · Meja{" "}
            {order.table?.number ?? "-"} · {formatIDR(order.total.toString())}
          </p>
        </div>
        <Link
          className="inline-flex h-8 items-center border border-console-border bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
          href={`/app/fb/orders/${order.id}`}
        >
          Kembali
        </Link>
      </div>
      <section className="border border-console-border bg-console-surface p-6">
        <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-600">
          {"// NEXT SESSION"}
        </div>
        <p className="mt-3 max-w-2xl text-[13px] leading-6 text-slate-600">
          Bill detail dan pembayaran akan dibangun pada FB-03/FB-04. Captain
          Order sudah menyimpan item, catatan, dan total order.
        </p>
      </section>
    </main>
  );
}
