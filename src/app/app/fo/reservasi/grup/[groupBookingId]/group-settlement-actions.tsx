"use client";

import {
  DepositStatus,
  GuestIdType,
  PaymentMethod,
  ReservationStatus,
} from "@prisma/client";
import { Banknote, CreditCard, LogIn, LogOut, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatIDR } from "@/lib/format";
import { formatGuestIdentity } from "@/lib/guest-id-type";

import { completeCheckIn } from "@/lib/check-in/actions";
import { SignaturePadField } from "@/components/check-in/signature-pad-field";
import {
  checkoutEligibleGroupRooms,
  collectGroupDeposits,
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

export type GroupCheckInRoom = {
  reservationId: number;
  reservationNo: string;
  roomId: number | null;
  roomNumber: string | null;
  status: ReservationStatus;
  depositStatus: DepositStatus;
  arrivalDate: string;
  requiredDeposit: string | null;
  guest: {
    fullName: string;
    idType: GuestIdType | null;
    idNumber: string | null;
    phone: string | null;
    email: string | null;
    nationality: string | null;
  };
};

function checkInSkipReason(room: GroupCheckInRoom, todayIso: string) {
  if (room.status === ReservationStatus.CHECKED_IN) return "Sudah check-in.";
  if (room.status === ReservationStatus.CHECKED_OUT) return "Sudah check-out.";
  if (room.status === ReservationStatus.CANCELLED) return "Reservasi dibatalkan.";
  if (room.status === ReservationStatus.NO_SHOW) return "Reservasi no-show.";
  if (room.status !== ReservationStatus.CONFIRMED) {
    return "Reservasi tidak dalam status yang bisa check-in.";
  }
  if (room.depositStatus === DepositStatus.PENDING) {
    return "Deposit belum dibayar.";
  }
  if (!room.roomId) return "Kamar belum ditugaskan.";
  if (room.arrivalDate > todayIso) {
    return `Belum waktunya check-in (arrival ${room.arrivalDate}).`;
  }

  return null;
}

function depositSkipReason(room: GroupCheckInRoom, todayIso: string) {
  if (room.status === ReservationStatus.CHECKED_IN) return "Sudah check-in.";
  if (room.status === ReservationStatus.CHECKED_OUT) return "Sudah check-out.";
  if (room.status === ReservationStatus.CANCELLED) return "Reservasi dibatalkan.";
  if (room.status === ReservationStatus.NO_SHOW) return "Reservasi no-show.";
  if (room.status !== ReservationStatus.CONFIRMED) {
    return "Reservasi tidak dapat mengumpulkan deposit.";
  }
  if (room.depositStatus === DepositStatus.COLLECTED) {
    return "Deposit sudah dikumpulkan.";
  }
  if (room.arrivalDate > todayIso) {
    return `Belum waktunya mengumpulkan deposit (arrival ${room.arrivalDate}).`;
  }
  if (
    room.requiredDeposit === null ||
    !Number.isFinite(Number(room.requiredDeposit)) ||
    Number(room.requiredDeposit) <= 0
  ) {
    return "Tarif malam pertama tidak tersedia atau tidak valid.";
  }

  return null;
}

function asResult(
  room: GroupCheckInRoom,
  status: GroupRoomActionResult["status"],
  reason: string,
): GroupRoomActionResult {
  return {
    reservationId: room.reservationId,
    reservationNo: room.reservationNo,
    roomNumber: room.roomNumber,
    status,
    reason,
  };
}

function resultClassName(status: GroupRoomActionResult["status"]) {
  if (status === "failed") {
    return "border-red-200 bg-red-50 text-red-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function statusLabel(status: GroupRoomActionResult["status"]) {
  if (status === "failed") return "Gagal";
  return "Dilewati";
}

function BatchResultSummary({ result }: { result: BatchResult }) {
  const skipped = result.results.filter((item) => item.status === "skipped").length;
  const failed = result.results.filter((item) => item.status === "failed").length;

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{result.title}</h3>
        <p className="text-xs font-medium text-slate-500">
          {skipped} dilewati · {failed} gagal
        </p>
      </div>
      <ul className="mt-3 space-y-2" aria-live="polite">
        {result.results.map((item) => (
          <li
            key={item.reservationId}
            className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${resultClassName(item.status)}`}
          >
            {item.status === "failed" ? (
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
  checkInRooms,
  todayIso,
  pendingDepositTotal,
}: {
  groupBookingId: string;
  checkInRooms: GroupCheckInRoom[];
  todayIso: string;
  pendingDepositTotal: string;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [reference, setReference] = useState("");
  const [depositMethod, setDepositMethod] = useState<PaymentMethod>(
    PaymentMethod.CASH,
  );
  const [depositReference, setDepositReference] = useState("");
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [isCheckInPanelOpen, setIsCheckInPanelOpen] = useState(false);
  const [groupPurposeOfVisit, setGroupPurposeOfVisit] = useState("Bisnis");
  const [arrivalConfirmed, setArrivalConfirmed] = useState(false);
  const [signatures, setSignatures] = useState<Record<number, string>>({});
  const [isCollectingDeposits, startDepositTransition] = useTransition();
  const [isSettling, startSettleTransition] = useTransition();
  const [isCheckingOut, startCheckoutTransition] = useTransition();
  const [isCheckingIn, startCheckInTransition] = useTransition();

  const depositEligibleRooms = checkInRooms.filter(
    (room) => !depositSkipReason(room, todayIso),
  );
  const checkInEligibleRooms = checkInRooms.filter(
    (room) => !checkInSkipReason(room, todayIso),
  );
  const everyEligibleRoomIsSigned = checkInEligibleRooms.every(
    (room) => Boolean(signatures[room.reservationId]),
  );

  function showBatchOutcome(
    title: string,
    results: GroupRoomActionResult[],
    successLabel: string,
  ) {
    const completedCount = results.filter(
      (item) => item.status === "completed",
    ).length;
    const exceptions = results.filter((item) => item.status !== "completed");

    setBatchResult(
      exceptions.length > 0 ? { title, results: exceptions } : null,
    );

    if (completedCount > 0) {
      toast.success(`${completedCount} kamar berhasil ${successLabel}.`);
    }
  }

  function collectDeposits() {
    setBatchResult(null);

    startDepositTransition(async () => {
      try {
        const result = await collectGroupDeposits({
          groupBookingId,
          method: depositMethod,
          reference: depositReference,
        });

        if (!result.ok) {
          toast.error(result.error);
          return;
        }

        showBatchOutcome(
          "Hasil pengumpulan deposit grup",
          result.results,
          "dikumpulkan depositnya",
        );
      } catch {
        toast.error(
          "Koneksi terputus saat memproses deposit. Muat ulang untuk memeriksa hasil tiap kamar.",
        );
      } finally {
        router.refresh();
      }
    });
  }

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

      showBatchOutcome(
        "Hasil settle saldo grup",
        result.results,
        "di-settle",
      );
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

      showBatchOutcome(
        "Hasil check-out kamar siap",
        result.results,
        "di-check-out",
      );
    });
  }

  function checkInEligibleRoomsInBatch() {
    setBatchResult(null);

    startCheckInTransition(async () => {
      const results: GroupRoomActionResult[] = [];

      // Each eligible room delegates to the same completeCheckIn action as
      // the individual flow. Deposit collection remains an explicit separate
      // step; Phase 1 skips PENDING siblings instead of silently failing them.
      for (const room of checkInRooms) {
        const skipReason = checkInSkipReason(room, todayIso);

        if (skipReason) {
          results.push(asResult(room, "skipped", skipReason));
          continue;
        }

        const signatureDataUrl = signatures[room.reservationId];
        if (!signatureDataUrl) {
          results.push(
            asResult(room, "skipped", "Tanda tangan GRC tamu wajib diisi."),
          );
          continue;
        }

        const formData = new FormData();
        formData.set("reservationId", String(room.reservationId));
        formData.set("roomId", String(room.roomId));
        formData.set("guestFullName", room.guest.fullName);
        formData.set("guestIdType", room.guest.idType ?? "");
        formData.set("guestIdNumber", room.guest.idNumber ?? "");
        formData.set("guestPhone", room.guest.phone ?? "");
        formData.set("guestEmail", room.guest.email ?? "");
        formData.set("guestNationality", room.guest.nationality ?? "");
        formData.set("purposeOfVisit", groupPurposeOfVisit);
        formData.set("purposeOfVisitOther", "");
        formData.set("signatureDataUrl", signatureDataUrl);
        formData.set("arrivalConfirmation", String(arrivalConfirmed));
        formData.set("depositMethod", "");
        formData.set("depositReference", "");

        const result = await completeCheckIn(formData, {
          redirectAfterCheckIn: false
        });
        results.push(
          result.ok
            ? asResult(room, "completed", "Check-in selesai.")
            : asResult(room, "failed", result.error),
        );
      }

      showBatchOutcome(
        "Hasil check-in kamar siap",
        results,
        "di-check-in",
      );
      setIsCheckInPanelOpen(false);
      router.refresh();
    });
  }

  const isPending =
    isCollectingDeposits || isSettling || isCheckingOut || isCheckingIn;

  return (
    <section className="mb-6 overflow-hidden rounded-lg border border-sky-200 bg-white shadow-sm">
      <div className="border-b border-sky-100 bg-sky-50 px-5 py-4">
        <h2 className="text-base font-semibold text-sky-950">Aksi grup</h2>
        <p className="mt-1 text-sm text-sky-800">
          Setiap pembayaran dan check-out tetap diproses pada folio kamar masing-masing.
        </p>
      </div>
      <div className="grid gap-5 p-5 lg:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
          <div className="flex items-start gap-3">
            <Banknote className="mt-0.5 h-5 w-5 text-emerald-700" aria-hidden="true" />
            <div>
              <h3 className="font-semibold text-slate-900">
                Kumpulkan deposit semua kamar
              </h3>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                Catat tarif malam pertama setiap kamar ke folionya sendiri. Deposit yang sudah terkumpul akan dilewati.
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-md border border-emerald-200 bg-white px-3 py-2.5">
            <p className="text-xs font-semibold text-emerald-800">
              Total deposit kamar pending
            </p>
            <p className="mt-0.5 font-bold tabular-nums text-emerald-950">
              {formatIDR(pendingDepositTotal)} untuk {depositEligibleRooms.length} kamar
            </p>
          </div>
          <div className="mt-4 grid gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">
                Metode deposit batch
              </span>
              <select
                value={depositMethod}
                onChange={(event) =>
                  setDepositMethod(event.target.value as PaymentMethod)
                }
                disabled={isPending}
                className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 desktop:h-10"
              >
                {paymentMethods.map((paymentMethod) => (
                  <option key={paymentMethod} value={paymentMethod}>
                    {paymentMethod}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">
                Referensi {depositMethod === PaymentMethod.TRANSFER ? "(wajib)" : "(opsional)"}
              </span>
              <Input
                value={depositReference}
                onChange={(event) => setDepositReference(event.target.value)}
                disabled={isPending}
                maxLength={100}
                placeholder="BCA TRF 12345"
                className="mt-1 h-11 border-slate-300 desktop:h-10"
              />
            </label>
          </div>
          <Button
            type="button"
            onClick={collectDeposits}
            disabled={isPending || depositEligibleRooms.length === 0}
            className="mt-4"
          >
            <Banknote className="h-4 w-4" aria-hidden="true" />
            {isCollectingDeposits
              ? "Memproses..."
              : depositEligibleRooms.length === 0
                ? "Tidak ada deposit pending"
                : `Kumpulkan ${formatIDR(pendingDepositTotal)} untuk ${depositEligibleRooms.length} kamar`}
          </Button>
        </div>

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
                              className="mt-1 h-11 desktop:h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
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
                className="mt-1 h-11 desktop:h-10 border-slate-300"
              />
            </label>
          </div>
          <Button
            type="button"
            onClick={settleBalances}
            disabled={isPending}
            className="mt-4"
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
            className="mt-4 border-sky-300 text-sky-800 hover:bg-sky-50 hover:text-sky-950"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {isCheckingOut ? "Memproses..." : "Check-out kamar yang siap"}
          </Button>
        </div>

        <div className="rounded-lg border border-slate-200 p-4">
          <div className="flex items-start gap-3">
            <LogIn className="mt-0.5 h-5 w-5 text-emerald-700" aria-hidden="true" />
            <div>
              <h3 className="font-semibold text-slate-900">Check-in kamar yang siap</h3>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                Kamar CONFIRMED yang sudah tiba, memiliki kamar, serta berstatus deposit COLLECTED dengan pembayaran DEPOSIT pada folio akan diproses satu per satu. Setiap tamu tetap wajib menandatangani GRC-nya sendiri.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsCheckInPanelOpen((current) => !current)}
            disabled={isPending || checkInEligibleRooms.length === 0}
            className="mt-4"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            {checkInEligibleRooms.length === 0
              ? "Tidak ada kamar siap"
              : "Check-in kamar yang siap"}
          </Button>
        </div>
      </div>
      {isCheckInPanelOpen ? (
        <div className="border-t border-slate-100 px-5 py-5">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
            <h3 className="text-sm font-semibold text-emerald-950">
              Lengkapi GRC sebelum check-in batch
            </h3>
            <p className="mt-1 text-sm leading-5 text-emerald-900">
              Tanda tangan di bawah disimpan pada reservasi kamar masing-masing. Data kontak tamu yang ada tidak diubah. Aksi check-in batch ini tidak mengumpulkan deposit; kamar dengan deposit PENDING akan dilewati dan deposit harus dikumpulkan terlebih dahulu.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Tujuan kunjungan seluruh grup</span>
                <select
                                  value={groupPurposeOfVisit}
                                  onChange={(event) => setGroupPurposeOfVisit(event.target.value)}
                                  disabled={isPending}
                                  className="mt-1 h-11 desktop:h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                                >
                  <option value="Bisnis">Bisnis</option>
                  <option value="Liburan">Liburan</option>
                  <option value="Keluarga">Keluarga</option>
                  <option value="Acara">Acara</option>
                </select>
              </label>
              <label className="mt-5 flex items-start gap-2 text-sm leading-5 text-slate-700 sm:mt-6">
                <input
                  type="checkbox"
                  checked={arrivalConfirmed}
                  onChange={(event) => setArrivalConfirmed(event.target.checked)}
                  disabled={isPending}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Saya mengonfirmasi setiap tamu yang diproses sudah hadir dan menandatangani GRC-nya sendiri.
              </label>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {checkInEligibleRooms.map((room) => (
                <div key={room.reservationId} className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="font-semibold text-slate-900">
                    {room.roomNumber ? `Kamar ${room.roomNumber}` : room.reservationNo}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600">{room.guest.fullName} · {room.reservationNo}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Identitas: {formatGuestIdentity(room.guest.idType, room.guest.idNumber)}
                  </p>
                  <div className="mt-3">
                    <span className="text-xs font-semibold text-slate-600">Tanda tangan tamu</span>
                    <div className="mt-1">
                      <SignaturePadField
                        value={signatures[room.reservationId] ?? ""}
                        onChange={(value) =>
                          setSignatures((current) => ({
                            ...current,
                            [room.reservationId]: value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Button
              type="button"
              onClick={checkInEligibleRoomsInBatch}
              disabled={isPending || !arrivalConfirmed || !everyEligibleRoomIsSigned}
              className="mt-5"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              {isCheckingIn ? "Memproses..." : `Proses ${checkInEligibleRooms.length} kamar siap`}
            </Button>
          </div>
        </div>
      ) : null}
      {batchResult ? <div className="border-t border-slate-100 px-5 pb-5"> <BatchResultSummary result={batchResult} /> </div> : null}
    </section>
  );
}
