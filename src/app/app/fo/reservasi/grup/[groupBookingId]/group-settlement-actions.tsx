"use client";

import { PaymentMethod } from "@prisma/client";
import { CheckCircle2, CreditCard, LogOut, XCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  checkoutEligibleGroupRooms,
  settleGroupBalances,
  type GroupRoomActionResult,
} from "./actions";

const paymentMethods = [
  PaymentMethod.CASH,
  PaymentMethod.TRANSFER,
  PaymentMethod.CARD,
] as const;

type BatchResult = {
  title: string;
  results: GroupRoomActionResult[];
};

function resultClassName(status: GroupRoomActionResult["status"]) {
  if (status === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }

  if (status === "failed") {
    return "border-red-200 bg-red-50 text-red-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function statusLabel(status: GroupRoomActionResult["status"]) {
  if (status === "completed") return "Selesai";
  if (status === "failed") return "Gagal";
  return "Dilewati";
}

function BatchResultSummary({ result }: { result: BatchResult }) {
  const completed = result.results.filter((item) => item.status === "completed").length;
  const skipped = result.results.filter((item) => item.status === "skipped").length;
  const failed = result.results.filter((item) => item.status === "failed").length;

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{result.title}</h3>
        <p className="text-xs font-medium text-slate-500">
          {completed} selesai · {skipped} dilewati · {failed} gagal
        </p>
      </div>
      <ul className="mt-3 space-y-2" aria-live="polite">
        {result.results.map((item) => (
          <li
            key={item.reservationId}
            className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${resultClassName(item.status)}`}
          >
            {item.status === "completed" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            ) : item.status === "failed" ? (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            ) : null}
            <p>
              <span className="font-semibold">
                {item.roomNumber ? `Kamar ${item.roomNumber}` : item.reservationNo}
              </span>{" "}
              <span className="text-xs">({item.reservationNo})</span>: {statusLabel(item.status)} — {item.reason}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GroupSettlementActions({
  groupBookingId,
}: {
  groupBookingId: string;
}) {
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [reference, setReference] = useState("");
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [isSettling, startSettleTransition] = useTransition();
  const [isCheckingOut, startCheckoutTransition] = useTransition();

  function settleBalances() {
    setBatchResult(null);

    startSettleTransition(async () => {
      const result = await settleGroupBalances({
        groupBookingId,
        method,
        reference,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setBatchResult({ title: "Hasil settle saldo grup", results: result.results });
      toast.success("Proses settle saldo grup selesai");
    });
  }

  function checkoutEligibleRooms() {
    setBatchResult(null);

    startCheckoutTransition(async () => {
      const result = await checkoutEligibleGroupRooms(groupBookingId);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setBatchResult({ title: "Hasil check-out kamar siap", results: result.results });
      toast.success("Proses check-out kamar siap selesai");
    });
  }

  const isPending = isSettling || isCheckingOut;

  return (
    <section className="mb-6 overflow-hidden rounded-lg border border-sky-200 bg-white shadow-sm">
      <div className="border-b border-sky-100 bg-sky-50 px-5 py-4">
        <h2 className="text-base font-semibold text-sky-950">Aksi grup</h2>
        <p className="mt-1 text-sm text-sky-800">
          Setiap pembayaran dan check-out tetap diproses pada folio kamar masing-masing.
        </p>
      </div>
      <div className="grid gap-5 p-5 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="flex items-start gap-3">
            <CreditCard className="mt-0.5 h-5 w-5 text-emerald-700" aria-hidden="true" />
            <div>
              <h3 className="font-semibold text-slate-900">Settle saldo grup</h3>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                Lunasi setiap folio OPEN yang masih memiliki saldo. Kamar tanpa folio atau yang sudah lunas akan dilewati.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Metode pembayaran batch</span>
              <select
                value={method}
                onChange={(event) => setMethod(event.target.value as PaymentMethod)}
                disabled={isPending}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
              >
                {paymentMethods.map((paymentMethod) => (
                  <option key={paymentMethod} value={paymentMethod}>{paymentMethod}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">
                Referensi {method === PaymentMethod.TRANSFER ? "(wajib)" : "(opsional)"}
              </span>
              <Input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                disabled={isPending}
                maxLength={100}
                placeholder="BCA TRF 12345"
                className="mt-1 h-9 border-slate-300"
              />
            </label>
          </div>
          <Button
            type="button"
            onClick={settleBalances}
            disabled={isPending}
            className="mt-4 h-9 bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <CreditCard className="h-4 w-4" aria-hidden="true" />
            {isSettling ? "Memproses..." : "Settle saldo grup"}
          </Button>
        </div>

        <div className="rounded-lg border border-slate-200 p-4">
          <div className="flex items-start gap-3">
            <LogOut className="mt-0.5 h-5 w-5 text-sky-700" aria-hidden="true" />
            <div>
              <h3 className="font-semibold text-slate-900">Check-out kamar yang siap</h3>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                Hanya kamar yang sudah check-in, lunas, dan departure hari ini yang diproses. Kamar lain akan dilewati dan dilaporkan.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={checkoutEligibleRooms}
            disabled={isPending}
            className="mt-4 h-9 border-sky-300 text-sky-800 hover:bg-sky-50 hover:text-sky-950"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {isCheckingOut ? "Memproses..." : "Check-out kamar yang siap"}
          </Button>
        </div>
      </div>
      {batchResult ? <div className="border-t border-slate-100 px-5 pb-5"> <BatchResultSummary result={batchResult} /> </div> : null}
    </section>
  );
}
