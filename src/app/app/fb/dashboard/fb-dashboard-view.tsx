import type { ReactNode } from "react";
import { Ban, Gift, Trash2, TrendingUp, UtensilsCrossed } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import type { FBDashboardMetrics } from "@/lib/fb/dashboard-metrics";
import { formatDecimalID, formatIDR } from "@/lib/format";

import { DashboardNote, DashboardPanel, DashboardTable, FBDashboardCards } from "./fb-dashboard-cards";
import { FBDatePicker } from "./fb-date-picker";

const serviceLabels: Record<string, string> = { DINE_IN: "Dine-in", ROOM_SERVICE: "Room Service" };
const tenderLabels: Record<string, string> = {
  CASH: "Cash", TRANSFER: "Transfer", CARD: "Card", CHARGE_TO_ROOM: "Charge to Room", UNKNOWN: "Not recorded",
};
const wibTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

function BillTime({ date }: { date: Date }) {
  return <time dateTime={date.toISOString()}>{wibTime.format(date)} WIB</time>;
}

export function FBDashboardView({ metrics, children, kitchenShortcut }: {
  metrics: FBDashboardMetrics;
  children?: ReactNode;
  kitchenShortcut?: ReactNode;
}) {
  return (
    <main className="min-w-0 w-full space-y-4 bg-slate-50 p-4 text-slate-900 sm:p-5 lg:p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
          <TrendingUp aria-hidden="true" className="size-6 shrink-0 text-emerald-700" />
          F&B Dashboard
        </h1>
        <div className="flex flex-wrap items-end gap-3">
          <FBDatePicker date={metrics.date} />
          <Link href="/app/fb/pos" className={buttonVariants()}>
            <UtensilsCrossed aria-hidden="true" className="size-4" />
            Open POS
          </Link>
          {kitchenShortcut}
        </div>
      </header>

      {children}

      <FBDashboardCards metrics={metrics} />

      <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
        <DashboardPanel title="Sales by Service Type">
          {metrics.settledCount === 0 ? <DashboardNote>No sales from settled bills on this date.</DashboardNote> : (
            <DashboardTable caption="Sales by service type" headers={[{ label: "Service" }, { label: "Bill", numeric: true }, { label: "Total", numeric: true }]}>
              {metrics.salesByService.map((row) => (
                <tr key={row.serviceType}>
                  <th scope="row">{serviceLabels[row.serviceType] ?? "Other services"}</th>
                  <td className="num text-right">{formatDecimalID(row.count, 0)}</td>
                  <td className="num whitespace-nowrap text-right">{formatIDR(row.total)}</td>
                </tr>
              ))}
            </DashboardTable>
          )}
        </DashboardPanel>
        <DashboardPanel title="Sales by Payment Method">
          {metrics.settledCount === 0 ? <DashboardNote>No payments from settled bills on this date.</DashboardNote> : (
            <DashboardTable caption="Sales by payment method" headers={[{ label: "Method" }, { label: "Bill", numeric: true }, { label: "Total", numeric: true }]}>
              {metrics.salesByTender.map((row) => (
                <tr key={row.paymentMethod}>
                  <th scope="row">{tenderLabels[row.paymentMethod] ?? "Other methods"}</th>
                  <td className="num text-right">{formatDecimalID(row.count, 0)}</td>
                  <td className="num whitespace-nowrap text-right">{formatIDR(row.total)}</td>
                </tr>
              ))}
            </DashboardTable>
          )}
        </DashboardPanel>
        <DashboardPanel title={`Currently Open Bills (${formatDecimalID(metrics.openBillCount, 0)})`}>
          <p className="mb-3 text-xs leading-5 text-slate-500">Opened on the selected date and still active now; this is not a historical snapshot. Duration is calculated up to the current time.</p>
          {metrics.openBills.length === 0 ? <DashboardNote>No bills opened on this date are still active.</DashboardNote> : (
            <DashboardTable caption="Currently active bills" headers={[{ label: "Bill" }, { label: "Location" }, { label: "Guest", numeric: true }, { label: "Opened" }, { label: "Duration", numeric: true }, { label: "Total", numeric: true }]}>
              {metrics.openBills.map((bill) => (
                <tr key={bill.id}>
                  <th scope="row" className="whitespace-nowrap">{bill.orderNo}</th>
                  <td>{bill.location}</td>
                  <td className="num text-right">{formatDecimalID(bill.guestCount, 0)}</td>
                  <td className="num whitespace-nowrap"><BillTime date={bill.openedAt} /></td>
                  <td className="num whitespace-nowrap text-right">{formatDecimalID(bill.elapsedMinutes, 0)} minutes</td>
                  <td className="num whitespace-nowrap text-right">{formatIDR(bill.total)}</td>
                </tr>
              ))}
            </DashboardTable>
          )}
        </DashboardPanel>
        <DashboardPanel title="Best-Selling Items">
          {metrics.topItems.length === 0 ? <DashboardNote>No menu items sold on settled bills for this date.</DashboardNote> : (
            <DashboardTable caption="Best-selling items from settled bills" headers={[{ label: "Menu" }, { label: "Quantity", numeric: true }, { label: "Sales", numeric: true }]}>
              {metrics.topItems.map((item) => (
                <tr key={item.menuItemId}>
                  <th scope="row" className="min-w-32 break-words">{item.name}</th>
                  <td className="num text-right">{formatDecimalID(item.quantity, 0)}</td>
                  <td className="num whitespace-nowrap text-right">{formatIDR(item.revenue)}</td>
                </tr>
              ))}
            </DashboardTable>
          )}
        </DashboardPanel>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-3 lg:gap-4">
        <DashboardPanel title={`Complimentary Bills (${formatDecimalID(metrics.complimentaryCount, 0)} · ${formatIDR(metrics.complimentaryTotal)})`} tone="amber" icon={Gift}>
          <DashboardNote>The data schema does not yet support complimentary bills. A value of 0 does not confirm that there were none.</DashboardNote>
        </DashboardPanel>
        <DashboardPanel title="Voided Items (0)" tone="red" icon={Trash2}>
          <DashboardNote>Items are permanently deleted; no void history is retained. A value of 0 does not confirm that no items were removed.</DashboardNote>
        </DashboardPanel>
        <DashboardPanel title={`Voided Orders (${formatDecimalID(metrics.voidedBills.length, 0)})`} tone="red" icon={Ban}>
          {metrics.voidedBills.length === 0 ? <DashboardNote>No orders were voided on this date.</DashboardNote> : (
            <DashboardTable caption="Orders voided on the selected date" headers={[{ label: "Bill" }, { label: "Location" }, { label: "Total", numeric: true }, { label: "Voided" }]}>
              {metrics.voidedBills.map((bill) => (
                <tr key={bill.id}>
                  <th scope="row" className="whitespace-nowrap">{bill.orderNo}</th>
                  <td>{bill.location}</td>
                  <td className="num whitespace-nowrap text-right">{formatIDR(bill.total)}</td>
                  <td className="num whitespace-nowrap">{bill.closedAt ? <BillTime date={bill.closedAt} /> : "Time unavailable"}</td>
                </tr>
              ))}
            </DashboardTable>
          )}
        </DashboardPanel>
      </div>
    </main>
  );
}
