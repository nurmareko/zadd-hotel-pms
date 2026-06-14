"use client";

import { PaymentMethod } from "@prisma/client";
import {
  Banknote,
  BedDouble,
  Check,
  CreditCard,
  Landmark,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { formatIDR } from "@/lib/format";

import {
  chargeOrderToRoom,
  lookupRoomForCharge,
  payOrderDirect,
  type ChargeLookupResult,
} from "../actions";

type PaymentFormProps = {
  orderId: number;
  orderNo: string;
  total: string;
  items: Array<{
    id: number;
    name: string;
    quantity: number;
    unitPrice: string;
    notes: string | null;
    guestLabel: string;
  }>;
  settings: {
    serviceChargePercent: string;
    taxPercent: string;
  };
  attachedRoomFolio?: {
    folioNo: string;
    roomNumber: string;
    guestName: string;
  } | null;
};

type PaymentSuccess = {
  method: PaymentMethod;
  receiptOrderId: number;
  paidTotal: string;
  amountTendered?: string;
  change?: string;
  folioNo?: string;
  fullyPaid: boolean;
};

type PaymentItem = PaymentFormProps["items"][number];

const methodOptions = [
  {
    value: PaymentMethod.CASH,
    label: "Tunai",
    detail: "Cash",
    icon: Banknote,
  },
  {
    value: PaymentMethod.CARD,
    label: "Kartu",
    detail: "Card",
    icon: CreditCard,
  },
  {
    value: PaymentMethod.TRANSFER,
    label: "Transfer",
    detail: "Bank transfer",
    icon: Landmark,
  },
  {
    value: PaymentMethod.CHARGE_TO_ROOM,
    label: "Charge to Room",
    detail: "Beban folio",
    icon: BedDouble,
  },
] as const;

const fieldClassName =
  "mt-1 h-8 rounded-none border-console-border bg-console-surface text-[12px]";

function downloadReceipt({
  orderId,
  orderNo,
  amountTendered,
  change,
}: {
  orderId: number;
  orderNo: string;
  amountTendered?: string;
  change?: string;
}) {
  const params = new URLSearchParams();

  if (amountTendered) {
    params.set("tendered", amountTendered);
  }

  if (change) {
    params.set("change", change);
  }

  const query = params.toString();
  const link = document.createElement("a");
  link.href = `/api/fb-orders/${orderId}/receipt${query ? `?${query}` : ""}`;
  link.download = `fb-receipt-${orderNo}.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
}

function methodLabel(method: PaymentMethod) {
  const option = methodOptions.find((item) => item.value === method);

  return option?.label ?? method;
}

function paymentItemGroupKey(item: PaymentItem) {
  return [item.name, item.unitPrice, item.notes ?? ""].join("\u001f");
}

function formatGuestLabels(items: PaymentItem[]) {
  return Array.from(new Set(items.map((item) => item.guestLabel))).join(", ");
}

function ResultMessage({ result }: { result: ChargeLookupResult }) {
  if (!result.ok) {
    return (
      <div className="border border-status-od-pip bg-status-od-bg px-3 py-2 text-[12px] font-medium text-status-od-fg">
        {result.error}
      </div>
    );
  }

  return (
    <div className="border border-status-oc-pip bg-status-oc-bg px-3 py-2 text-[12px] text-status-oc-fg">
      <div className="font-semibold">Tamu in-house ditemukan.</div>
      <div className="mt-1 leading-5">
        Akan dibebankan ke: {result.guestName} · Kamar {result.roomNumber} ·{" "}
        <span className="num font-semibold">{result.folioNo}</span>
      </div>
    </div>
  );
}

export function PaymentForm({
  orderId,
  orderNo,
  total,
  items,
  settings,
  attachedRoomFolio = null,
}: PaymentFormProps) {
  const groupedItems = useMemo(() => {
    const groups = new Map<
      string,
      PaymentItem & {
        items: PaymentItem[];
        totalQuantity: number;
        guestLabels: string;
      }
    >();

    for (const item of items) {
      const key = paymentItemGroupKey(item);
      const current = groups.get(key);

      if (current) {
        current.items.push(item);
        current.totalQuantity += item.quantity;
        current.guestLabels = formatGuestLabels(current.items);
      } else {
        groups.set(key, {
          ...item,
          items: [item],
          totalQuantity: item.quantity,
          guestLabels: item.guestLabel,
        });
      }
    }

    return Array.from(groups.values());
  }, [items]);
  const [selectedQuantities, setSelectedQuantities] = useState(() =>
    Object.fromEntries(items.map((item) => [item.id, item.quantity])),
  );
  const selectedItems = useMemo(
    () =>
      items
        .map((item) => ({
          orderItemId: item.id,
          quantity: selectedQuantities[item.id] ?? 0,
        }))
        .filter((item) => item.quantity > 0),
    [items, selectedQuantities],
  );
  const selectedSubtotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        const quantity = selectedQuantities[item.id] ?? 0;

        return sum + Number(item.unitPrice) * quantity;
      }, 0),
    [items, selectedQuantities],
  );
  const selectedServiceCharge =
    selectedSubtotal * (Number(settings.serviceChargePercent) / 100);
  const selectedTax =
    (selectedSubtotal + selectedServiceCharge) *
    (Number(settings.taxPercent) / 100);
  const selectedTotal = selectedSubtotal + selectedServiceCharge + selectedTax;
  const selectedTotalString = selectedTotal.toFixed(2);
  const totalNumber = selectedTotal;
  const [method, setMethod] = useState<PaymentMethod>(
    attachedRoomFolio ? PaymentMethod.CHARGE_TO_ROOM : PaymentMethod.CASH,
  );
  const [amountTendered, setAmountTendered] = useState("");
  const [reference, setReference] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [lookupResult, setLookupResult] = useState<ChargeLookupResult | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<PaymentSuccess | null>(null);
  const [isLookupPending, startLookupTransition] = useTransition();
  const [isSubmitPending, startSubmitTransition] = useTransition();

  const tenderedNumber = Number(amountTendered || 0);
  const change = useMemo(
    () => tenderedNumber - totalNumber,
    [tenderedNumber, totalNumber],
  );
  const cashIsValid =
    method !== PaymentMethod.CASH || tenderedNumber >= totalNumber;
  const canSubmitCharge =
    method !== PaymentMethod.CHARGE_TO_ROOM ||
    Boolean(attachedRoomFolio) ||
    lookupResult?.ok === true;
  const hasSelection = selectedItems.length > 0 && selectedTotal > 0;

  function selectedGroupQuantity(groupItems: PaymentItem[]) {
    return groupItems.reduce(
      (sum, item) => sum + (selectedQuantities[item.id] ?? 0),
      0,
    );
  }

  function setSelectedGroupQuantity(groupItems: PaymentItem[], quantity: number) {
    setSelectedQuantities((current) => {
      let remainingQuantity = quantity;
      const next = { ...current };

      for (const item of groupItems) {
        const itemQuantity = Math.min(item.quantity, remainingQuantity);

        next[item.id] = itemQuantity;
        remainingQuantity -= itemQuantity;
      }

      return next;
    });
  }

  useEffect(() => {
    if (method !== PaymentMethod.CHARGE_TO_ROOM) {
      return;
    }

    const normalizedRoom = roomNumber.trim();

    if (!normalizedRoom) {
      return;
    }

    const timeout = window.setTimeout(() => {
      startLookupTransition(async () => {
        const result = await lookupRoomForCharge({
          roomNumber: normalizedRoom,
        });
        setLookupResult(result);
      });
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [method, roomNumber]);

  function handleDirectSubmit() {
    setActionError(null);

    startSubmitTransition(async () => {
      const result = await payOrderDirect({
        orderId,
        method,
        selectedItems,
        amountTendered:
          method === PaymentMethod.CASH ? tenderedNumber : undefined,
        reference,
      });

      if (!result.ok) {
        setActionError(result.error);
        toast.error(result.error);
        return;
      }

      const nextSuccess = {
        method: result.paymentMethod,
        receiptOrderId: result.receiptOrderId,
        paidTotal: result.paidTotal,
        amountTendered: result.amountTendered,
        change: result.change,
        fullyPaid: result.fullyPaid ?? true,
      };

      setSuccess(nextSuccess);
      toast.success(
        result.alreadyClosed
          ? "Order sudah tertutup"
          : "Pembayaran selesai",
      );
      downloadReceipt({
        orderId: result.receiptOrderId,
        orderNo,
        ...nextSuccess,
      });
    });
  }

  function handleChargeSubmit() {
    setActionError(null);

    startSubmitTransition(async () => {
      const result = await chargeOrderToRoom({
        orderId,
        roomNumber: attachedRoomFolio ? undefined : roomNumber,
        selectedItems,
      });

      if (!result.ok) {
        setActionError(result.error);
        toast.error(result.error);
        return;
      }

      const nextSuccess = {
        method: result.paymentMethod,
        receiptOrderId: result.receiptOrderId,
        paidTotal: result.paidTotal,
        folioNo: result.folioNo,
        fullyPaid: result.fullyPaid ?? true,
      };

      setSuccess(nextSuccess);
      toast.success(
        result.alreadyClosed
          ? "Order sudah tertutup"
          : "Order dibebankan ke folio",
      );
      downloadReceipt({ orderId: result.receiptOrderId, orderNo });
    });
  }

  if (success) {
    return (
      <section className="border border-status-vc-pip bg-status-vc-bg">
        <div className="bg-console-ink px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
          {"PEMBAYARAN SELESAI"}
        </div>
        <div className="grid gap-3 p-3.5 text-[12px] text-status-vc-fg">
          <div>
            <div className="text-[15px] font-bold uppercase tracking-[0.04em]">
              Order ditutup
            </div>
            <div className="mt-1">
              Metode:{" "}
              <span className="font-semibold">{methodLabel(success.method)}</span>{" "}
              - Total{" "}
              <span className="num font-semibold">
                {formatIDR(success.paidTotal)}
              </span>
              {success.folioNo ? (
                <>
                  {" "}
                  · Folio <span className="num font-semibold">{success.folioNo}</span>
                </>
              ) : null}
            </div>
          </div>
          {success.method === PaymentMethod.CASH && success.change ? (
            <div className="grid gap-1 border border-status-vc-pip bg-white px-3 py-2 text-console-ink sm:grid-cols-2">
              <div>
                <span className="text-slate-500">Uang diterima</span>{" "}
                <span className="num font-semibold">
                  {formatIDR(success.amountTendered ?? total)}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Kembalian</span>{" "}
                <span className="num font-semibold">
                  {formatIDR(success.change)}
                </span>
              </div>
            </div>
          ) : null}
          <div className="flex flex-col gap-2 border-t border-status-vc-pip pt-3 sm:flex-row">
            <button
              className="inline-flex h-8 items-center justify-center border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
              onClick={() =>
                downloadReceipt({
                  orderId: success.receiptOrderId,
                  orderNo,
                  amountTendered: success.amountTendered,
                  change: success.change,
                })
              }
              type="button"
            >
              Cetak Struk
            </button>
            {!success.fullyPaid ? (
              <button
                className="inline-flex h-8 items-center justify-center border border-console-border bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
                onClick={() => {
                  window.location.href = `/app/fb/orders/${orderId}/payment`;
                }}
              >
                Kembali ke Pembayaran
              </button>
            ) : null}
            <Link
              className="inline-flex h-8 items-center justify-center border border-console-border bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
              href="/app/fb"
            >
              Kembali ke Daftar Meja
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="border border-console-border bg-console-surface">
      <div className="bg-console-ink px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
        {"METODE PEMBAYARAN"}
      </div>

      <div className="grid gap-3 p-3.5">
        <div className="border border-console-border bg-console-bg">
          <div className="flex flex-col gap-2 border-b border-console-border bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-console-ink">
                Item yang dibayar
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Pilih item dan quantity untuk struk tamu ini.
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="h-7 border border-console-border bg-white px-2 text-[10px] font-semibold uppercase tracking-[0.04em] hover:border-console-ink"
                onClick={() =>
                  setSelectedQuantities(
                    Object.fromEntries(
                      items.map((item) => [item.id, item.quantity]),
                    ),
                  )
                }
                type="button"
              >
                Semua
              </button>
              <button
                className="h-7 border border-console-border bg-white px-2 text-[10px] font-semibold uppercase tracking-[0.04em] hover:border-console-ink"
                onClick={() =>
                  setSelectedQuantities(
                    Object.fromEntries(items.map((item) => [item.id, 0])),
                  )
                }
                type="button"
              >
                Kosongkan
              </button>
            </div>
          </div>
          <div className="grid gap-2 p-3">
            {groupedItems.map((item) => {
              const quantity = selectedGroupQuantity(item.items);

              return (
                <div
                  className="grid gap-2 border border-console-border bg-white p-2 text-[12px] sm:grid-cols-[minmax(0,1fr)_90px_120px]"
                  key={paymentItemGroupKey(item)}
                >
                  <div>
                    <div className="font-semibold text-console-ink">
                      {item.name}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      {item.guestLabels} - Sisa {item.totalQuantity} -{" "}
                      {formatIDR(item.unitPrice)}
                    </div>
                    {item.notes ? (
                      <div className="mt-1 text-[11px] italic text-status-vd-fg">
                        {item.notes}
                      </div>
                    ) : null}
                  </div>
                  <Input
                    className="h-8 rounded-none border-console-border bg-console-surface text-right text-[12px]"
                    max={item.totalQuantity}
                    min={0}
                    onChange={(event) => {
                      const nextQuantity = Math.min(
                        item.totalQuantity,
                        Math.max(0, Number(event.target.value || 0)),
                      );

                      setSelectedGroupQuantity(item.items, nextQuantity);
                    }}
                    type="number"
                    value={quantity}
                  />
                  <div className="flex items-center justify-between gap-2 border border-console-border bg-console-bg px-2 text-[11px] sm:justify-end">
                    <span className="text-slate-500 sm:hidden">Jumlah</span>
                    <span className="num font-semibold text-console-ink">
                      {formatIDR(Number(item.unitPrice) * quantity)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid gap-1 border-t border-console-border bg-white px-3 py-2 text-[12px] sm:grid-cols-4">
            <div>
              <span className="text-slate-500">Subtotal</span>{" "}
              <span className="num font-semibold">
                {formatIDR(selectedSubtotal)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">SC</span>{" "}
              <span className="num font-semibold">
                {formatIDR(selectedServiceCharge)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Pajak</span>{" "}
              <span className="num font-semibold">{formatIDR(selectedTax)}</span>
            </div>
            <div className="sm:text-right">
              <span className="text-slate-500">Total bayar</span>{" "}
              <span className="num text-[14px] font-bold text-console-ink">
                {formatIDR(selectedTotalString)}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {methodOptions.map((option) => {
            const Icon = option.icon;
            const selected = method === option.value;

            return (
              <button
                className={`min-h-24 border p-3 text-left transition-colors ${selected
                    ? "border-console-ink bg-console-ink text-console-accent"
                    : "border-console-border bg-white text-console-ink hover:border-console-ink hover:bg-console-bg"
                  }`}
                key={option.value}
                onClick={() => {
                  setMethod(option.value);
                  setActionError(null);
                }}
                type="button"
              >
                <div className="flex items-center justify-between">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {selected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                </div>
                <div className="mt-3 text-[13px] font-bold uppercase tracking-[0.04em]">
                  {option.label}
                </div>
                <div
                  className={`mt-1 text-[11px] ${selected ? "text-slate-300" : "text-slate-500"
                    }`}
                >
                  {option.detail}
                </div>
              </button>
            );
          })}
        </div>

        <div className="border-t border-console-border pt-3">
          {method === PaymentMethod.CASH ? (
            <div className="grid gap-3">
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                  Uang Diterima
                </span>
                <Input
                  className={fieldClassName}
                  min={0}
                  onChange={(event) => setAmountTendered(event.target.value)}
                  placeholder={selectedTotalString}
                  step={0.01}
                  type="number"
                  value={amountTendered}
                />
              </label>
              <div className="border border-console-border bg-console-bg px-3 py-2 text-[12px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Kembalian</span>
                  <span
                    className={`num text-[16px] font-bold ${change < 0 ? "text-status-od-fg" : "text-console-ink"
                      }`}
                  >
                    {formatIDR(Math.max(change, 0))}
                  </span>
                </div>
                {!cashIsValid ? (
                  <div className="mt-1 text-[11px] font-medium text-status-od-fg">
                    Uang diterima kurang dari total tagihan.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {method === PaymentMethod.CARD ? (
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                Nomor Approval / Referensi
              </span>
              <Input
                className={fieldClassName}
                maxLength={100}
                onChange={(event) => setReference(event.target.value)}
                placeholder="EDC 123456"
                value={reference}
              />
            </label>
          ) : null}

          {method === PaymentMethod.TRANSFER ? (
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                Nomor Referensi Transfer
              </span>
              <Input
                className={fieldClassName}
                maxLength={100}
                onChange={(event) => setReference(event.target.value)}
                placeholder="BCA TRF 12345"
                value={reference}
              />
            </label>
          ) : null}

          {method === PaymentMethod.CHARGE_TO_ROOM ? (
            <div className="grid gap-3">
              {attachedRoomFolio ? (
                <div className="border border-status-oc-pip bg-status-oc-bg px-3 py-2 text-[12px] text-status-oc-fg">
                  <div className="font-semibold">
                    Folio room service sudah terhubung.
                  </div>
                  <div className="mt-1 leading-5">
                    Akan dibebankan ke: {attachedRoomFolio.guestName} · Kamar{" "}
                    {attachedRoomFolio.roomNumber} ·{" "}
                    <span className="num font-semibold">
                      {attachedRoomFolio.folioNo}
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                      Nomor Kamar
                    </span>
                    <Input
                      className={fieldClassName}
                      maxLength={10}
                      onChange={(event) => {
                        setRoomNumber(event.target.value);
                        setLookupResult(null);
                      }}
                      placeholder="204"
                      value={roomNumber}
                    />
                  </label>
                  {isLookupPending ? (
                    <div className="border border-console-border bg-console-bg px-3 py-2 text-[12px] text-slate-500">
                      Mencari tamu in-house...
                    </div>
                  ) : lookupResult ? (
                    <ResultMessage result={lookupResult} />
                  ) : (
                    <div className="border border-dashed border-console-border bg-console-bg px-3 py-2 text-[12px] text-slate-500">
                      Masukkan nomor kamar untuk validasi folio aktif.
                    </div>
                  )}
                </>
              )}
            </div>
          ) : null}
        </div>

        {actionError ? (
          <p className="border border-status-od-pip bg-status-od-bg px-3 py-2 text-[12px] font-medium text-status-od-fg">
            {actionError}
          </p>
        ) : null}

        <div className="flex justify-end border-t border-console-border pt-3">
          <button
            className="inline-flex h-8 items-center justify-center border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800 disabled:border-console-border disabled:bg-console-bg disabled:text-slate-400"
            disabled={
              isSubmitPending ||
              !hasSelection ||
              !cashIsValid ||
              !canSubmitCharge ||
              (method === PaymentMethod.CASH && !amountTendered)
            }
            onClick={
              method === PaymentMethod.CHARGE_TO_ROOM
                ? handleChargeSubmit
                : handleDirectSubmit
            }
            type="button"
          >
            {isSubmitPending
              ? "Memproses..."
              : method === PaymentMethod.CHARGE_TO_ROOM
                ? "Bebankan ke Kamar"
                : "Selesaikan Pembayaran"}
          </button>
        </div>
      </div>
    </section>
  );
}
