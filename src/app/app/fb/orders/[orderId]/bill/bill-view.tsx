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
      className={`flex items-center justify-between gap-4 border-b border-gray-100 py-2 ${
        strong ? "pt-3 text-base font-bold" : "text-sm"
      }`}
    >
      <span className="text-slate-600">{label}</span>
      <span className={`num text-slate-900 ${strong ? "text-2xl" : ""}`}>
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
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-4">
        <div className="text-base font-semibold text-slate-900">
          Tagihan
        </div>
        <div className="mt-1 text-sm text-slate-500">
          Detail bill dan ringkasan pembayaran order.
        </div>
      </div>

      <div className="p-4 md:p-5">
        <div className="rounded-2xl border border-gray-200 bg-slate-50 p-4">
          <div className="text-xl font-bold text-slate-900">
            {settings.hotelName}
          </div>
          <div className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            {settings.address ?? "-"}
          </div>
          <div className="mt-4 text-sm font-semibold text-slate-700">
            Bill / Tagihan
          </div>
        </div>

        <div className="grid gap-x-5 gap-y-3 border-b border-gray-100 py-4 text-sm sm:grid-cols-2">
          <BillMeta label="Order #" value={order.orderNo} />
          <BillMeta label="Lokasi" value={order.locationLabel} />
          <BillMeta label="Jumlah Tamu" value={`${order.guestCount} pax`} />
          <BillMeta label="Tanggal/Waktu" value={order.openedAtLabel} />
          <BillMeta label="Kasir" value={order.cashierName} />
        </div>

        <div className="mt-4 overflow-auto">
          <table className="min-w-[760px] w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-gray-200 bg-slate-50 px-3.5 py-3 text-left text-xs font-semibold text-slate-600">
                  Item
                </th>
                <th className="border-b border-gray-200 bg-slate-50 px-3.5 py-3 text-right text-xs font-semibold text-slate-600">
                  Qty
                </th>
                <th className="border-b border-gray-200 bg-slate-50 px-3.5 py-3 text-right text-xs font-semibold text-slate-600">
                  Harga Satuan
                </th>
                <th className="border-b border-gray-200 bg-slate-50 px-3.5 py-3 text-right text-xs font-semibold text-slate-600">
                  Jumlah
                </th>
              </tr>
            </thead>
            <tbody>
              {order.items.length === 0 ? (
                <tr>
                  <td className="border-b border-gray-100 px-3 py-3" colSpan={4}>
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
                      className="border-b border-gray-100 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-600"
                      colSpan={4}
                    >
                      {fbOrderGuestLabel(guestNumber)}
                    </td>
                  </tr>,
                  ...items.map((item) => (
                    <tr
                      className="border-b border-gray-100 odd:bg-white even:bg-slate-50/70"
                      key={item.id}
                    >
                      <td className="px-3.5 py-3 align-top">
                        <div className="font-semibold text-slate-900">
                          {item.name}
                        </div>
                        {item.notes ? (
                          <div className="mt-1 max-w-[520px] whitespace-pre-wrap break-words text-xs italic leading-5 text-status-vd-fg">
                            {item.notes}
                          </div>
                        ) : null}
                      </td>
                      <td className="num px-3.5 py-3 text-right align-top text-slate-700">
                        {item.quantity}
                      </td>
                      <td className="num px-3.5 py-3 text-right align-top text-slate-700">
                        {formatIDR(item.unitPrice)}
                      </td>
                      <td className="num px-3.5 py-3 text-right align-top font-semibold text-slate-900">
                        {formatIDR(item.amount)}
                      </td>
                    </tr>
                  )),
                ])
              )}
            </tbody>
          </table>
        </div>

        <div className="ml-auto mt-5 w-full max-w-sm rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3">
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
      <div className="text-xs font-medium text-slate-500">
        {label}
      </div>
      <div className="num mt-1 font-semibold text-slate-900">{value}</div>
    </div>
  );
}
