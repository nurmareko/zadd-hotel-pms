import { fbOrderGuestLabel } from "@/lib/fb-order-guest";
import { formatDecimalID, formatIDR } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";
import { ReceiptText } from "lucide-react";

type BillViewProps = {
  order: {
    orderNo: string;
    locationLabel: string;
    guestCount: number;
    openedAtLabel: string;
    cashierName: string;
    items: Array<{
      id: number;
      name: string;
      quantity: number;
      unitPrice: string;
      amount: string;
      notes: string;
      guestNumber: number;
    }>;
  };
  settings: {
    hotelName: string;
    address: string | null;
    serviceChargePercent: string;
    taxPercent: string;
  };
  totals: {
    subtotal: string;
    serviceCharge: string;
    tax: string;
    total: string;
  };
};

function shouldShowPercentRow(percent: string) {
  return Number(percent) > 0;
}

function percentLabel(percent: string) {
  return formatDecimalID(percent);
}

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 border-b border-console-border-soft py-1.5 ${
        strong ? "text-[15px] font-bold uppercase tracking-[0.04em]" : ""
      }`}
    >
      <span className="text-slate-600">{label}</span>
      <span className={`num text-console-ink ${strong ? "text-[20px]" : ""}`}>
        {value}
      </span>
    </div>
  );
}

export function BillView({ order, settings, totals }: BillViewProps) {
  const itemsByGuest = Array.from(
    order.items.reduce((groups, item) => {
      const guestNumber = item.guestNumber || 1;
      const currentItems = groups.get(guestNumber) ?? [];

      currentItems.push(item);
      groups.set(guestNumber, currentItems);

      return groups;
    }, new Map<number, typeof order.items>()),
  ).sort(([firstGuest], [secondGuest]) => firstGuest - secondGuest);

  return (
    <section className="border border-console-border bg-console-surface">
      <div className="border-b border-console-border bg-console-ink px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
        {"// TAGIHAN"}
      </div>

      <div className="p-4">
        <div className="border-b border-console-ink pb-3">
          <div className="text-[18px] font-bold uppercase tracking-[0.02em] text-console-ink">
            {settings.hotelName}
          </div>
          <div className="mt-1 max-w-2xl text-[11px] leading-5 text-slate-500">
            {settings.address ?? "-"}
          </div>
          <div className="mt-3 text-[12px] font-bold uppercase tracking-[0.08em]">
            Bill / Tagihan
          </div>
        </div>

        <div className="grid gap-x-5 gap-y-2 border-b border-console-border py-3 text-[12px] sm:grid-cols-2">
          <BillMeta label="Order #" value={order.orderNo} />
          <BillMeta label="Lokasi" value={order.locationLabel} />
          <BillMeta label="Jumlah Tamu" value={`${order.guestCount} pax`} />
          <BillMeta label="Tanggal/Waktu" value={order.openedAtLabel} />
          <BillMeta label="Kasir" value={order.cashierName} />
        </div>

        <div className="mt-4 overflow-auto">
          <table className="min-w-[760px] w-full border-collapse text-[12px]">
            <thead>
              <tr>
                <th className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                  Item
                </th>
                <th className="bg-console-ink px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                  Qty
                </th>
                <th className="bg-console-ink px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                  Harga Satuan
                </th>
                <th className="bg-console-ink px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                  Jumlah
                </th>
              </tr>
            </thead>
            <tbody>
              {order.items.length === 0 ? (
                <tr>
                  <td className="border-b border-console-border-soft px-3 py-3" colSpan={4}>
                    <EmptyState
                      icon={ReceiptText}
                      title="Order masih kosong"
                      description="Tambahkan item terlebih dahulu sebelum bill dikonfirmasi."
                    />
                  </td>
                </tr>
              ) : (
                itemsByGuest.flatMap(([guestNumber, items]) => [
                  <tr key={`guest-${guestNumber}`}>
                    <td
                      className="border-b border-console-border-soft bg-console-bg px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600"
                      colSpan={4}
                    >
                      {fbOrderGuestLabel(guestNumber)}
                    </td>
                  </tr>,
                  ...items.map((item) => (
                    <tr
                      className="border-b border-console-border-soft odd:bg-white even:bg-console-bg"
                      key={item.id}
                    >
                      <td className="px-3 py-2 align-top">
                        <div className="font-semibold text-console-ink">
                          {item.name}
                        </div>
                        {item.notes ? (
                          <div className="mt-1 max-w-[520px] whitespace-pre-wrap break-words text-[11px] italic leading-5 text-status-vd-fg">
                            {item.notes}
                          </div>
                        ) : null}
                      </td>
                      <td className="num px-3 py-2 text-right align-top text-slate-700">
                        {item.quantity}
                      </td>
                      <td className="num px-3 py-2 text-right align-top text-slate-700">
                        {formatIDR(item.unitPrice)}
                      </td>
                      <td className="num px-3 py-2 text-right align-top font-semibold text-console-ink">
                        {formatIDR(item.amount)}
                      </td>
                    </tr>
                  )),
                ])
              )}
            </tbody>
          </table>
        </div>

        <div className="ml-auto mt-4 w-full max-w-sm text-[12px]">
          <SummaryRow label="Subtotal" value={formatIDR(totals.subtotal)} />
          {shouldShowPercentRow(settings.serviceChargePercent) ? (
            <SummaryRow
              label={`Service Charge (${percentLabel(
                settings.serviceChargePercent,
              )}%)`}
              value={formatIDR(totals.serviceCharge)}
            />
          ) : null}
          {shouldShowPercentRow(settings.taxPercent) ? (
            <SummaryRow
              label={`Pajak (${percentLabel(settings.taxPercent)}%)`}
              value={formatIDR(totals.tax)}
            />
          ) : null}
          <SummaryRow label="Total" value={formatIDR(totals.total)} strong />
        </div>
      </div>
    </section>
  );
}

function BillMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
        {label}
      </div>
      <div className="num mt-1 font-semibold text-console-ink">{value}</div>
    </div>
  );
}
