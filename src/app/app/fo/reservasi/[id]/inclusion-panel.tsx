"use client";

import type {
  ArrangementType,
  ReservationStayFeeKind,
  ReservationStayFeeStatus,
} from "@prisma/client";
import { LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatIDR } from "@/lib/format";
import {
  changeReservationMealPlan,
  setReservationStayFee,
} from "./actions";

type InclusionNight = {
  id: string;
  dateLabel: string;
  rateAmount: string;
  plan: ArrangementType;
  pax: number;
  unitPrice: string;
  amount: string;
  lockReason: "posted" | "elapsed" | "terminal" | null;
};

type MealPlanOption = {
  value: ArrangementType;
  label: string;
  unitPrice: string;
};

type StayFeeOption = {
  kind: ReservationStayFeeKind;
  label: string;
  unitPrice: string;
  status: ReservationStayFeeStatus | null;
};

type InclusionPanelProps = {
  reservationId: number;
  currentPlan: ArrangementType;
  currentPlanLabel: string;
  pax: number;
  nights: InclusionNight[];
  options: MealPlanOption[];
  terminal: boolean;
  effectiveDateLabel: string | null;
  editableNightCount: number;
  inHouse: boolean;
  stayFees: StayFeeOption[];
};

export function InclusionPanel({
  reservationId,
  currentPlan,
  currentPlanLabel,
  pax,
  nights,
  options,
  terminal,
  effectiveDateLabel,
  editableNightCount,
  inHouse,
  stayFees,
}: InclusionPanelProps) {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<ArrangementType>(currentPlan);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [unitPrice, setUnitPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingFeeKind, setPendingFeeKind] =
    useState<ReservationStayFeeKind | null>(null);
  const selectedOption = options.find((option) => option.value === selectedPlan);
  const persistedUnitPrices = Array.from(
    new Set(nights.map((night) => night.unitPrice)),
  );
  const persistedUnitPriceLabel =
    persistedUnitPrices.length === 0
      ? "Tidak tersedia"
      : persistedUnitPrices.length > 1
        ? "Bervariasi per malam"
        : `${formatIDR(persistedUnitPrices[0])} / malam`;
  const editableNights = nights.filter((night) => night.lockReason === null);
  const editableCurrentPlanPrices = Array.from(new Set(
    editableNights
      .filter((night) => night.plan === currentPlan)
      .map((night) => Number(night.unitPrice)),
  ));

  function initialUnitPrice(plan: ArrangementType) {
    if (plan === currentPlan && editableCurrentPlanPrices.length > 0) {
      return editableCurrentPlanPrices.length === 1
        ? String(editableCurrentPlanPrices[0])
        : "";
    }
    return options.find((option) => option.value === plan)?.unitPrice ?? "";
  }

  const previewUnitPrice = selectedPlan === "RO" ? 0 : Number(unitPrice);
  const validUnitPrice =
    selectedPlan === "RO" ||
    (unitPrice.trim() !== "" &&
      Number.isSafeInteger(previewUnitPrice) &&
      previewUnitPrice >= 0);
  const nightlyAllocation = previewUnitPrice * pax;
  const totalAllocation = nightlyAllocation * editableNightCount;
  const validAllocation = validUnitPrice && Number.isSafeInteger(totalAllocation);
  const overAllocatedNight = validAllocation
    ? editableNights.find((night) => nightlyAllocation > Number(night.rateAmount))
    : undefined;
  const eligiblePackageTotal = editableNights.reduce(
    (total, night) => total + Number(night.rateAmount), 0,
  );
  const hasChange = selectedPlan !== currentPlan ||
    (selectedPlan !== "RO" && validAllocation && editableNights.some(
      (night) => Number(night.unitPrice) !== previewUnitPrice,
    ));
  const canSubmit =
    !terminal &&
    editableNightCount > 0 &&
    Boolean(effectiveDateLabel) &&
    Boolean(selectedOption) &&
    hasChange &&
    validAllocation &&
    !overAllocatedNight &&
    !isPending;

  function changeDialogOpen(open: boolean) {
    if (isPending) return;
    if (open) {
      setSelectedPlan(currentPlan);
      setUnitPrice(initialUnitPrice(currentPlan));
      setError(null);
    }
    setDialogOpen(open);
  }

  function changeStayFee(fee: StayFeeOption, selected: boolean) {
    if (terminal || fee.status === "POSTED" || pendingFeeKind !== null) {
      return;
    }

    if (
      !selected &&
      !window.confirm(
        `Hapus pilihan ${fee.label}? Riwayat pilihan akan dipertahankan dengan status dibatalkan.`, 
      )
    ) {
      return;
    }

    setPendingFeeKind(fee.kind);
    startTransition(async () => {
      const result = await setReservationStayFee({
        reservationId,
        kind: fee.kind,
        selected,
      });

      if (!result.ok) {
        toast.error(result.error);
        setPendingFeeKind(null);
        return;
      }

      toast.success(
        result.status === "POSTED"
          ? `${fee.label} langsung terposting ke folio terbuka.`
          : result.status === "PENDING"
            ? `${fee.label} disimpan dan menunggu posting saat check-in.`
            : `${fee.label} dibatalkan; riwayat pilihan tetap disimpan.`,
      );
      router.refresh();
      setPendingFeeKind(null);
    });
  }

  function submitChange() {
    if (!canSubmit || !effectiveDateLabel || !selectedOption) {
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const result = await changeReservationMealPlan({
          reservationId,
          arrangementType: selectedPlan,
          unitPriceOverride: selectedPlan === "RO" ? undefined : previewUnitPrice,
        });

        if (!result.ok) {
          setError(result.error);
          return;
        }

        toast.success(
          `Arrangement diperbarui mulai ${result.effectiveDate} untuk ${result.changedNights} malam.`,
        );
        setDialogOpen(false);
        router.refresh();
      } catch {
        setError("Tidak dapat memastikan perubahan tersimpan. Muat ulang untuk memeriksa Arrangement sebelum mencoba lagi.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Arrangement Saat Ini</h2>
        </div>
        <dl className="grid gap-4 p-5 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium text-slate-500">Arrangement</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">
              {currentPlanLabel}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">
              Harga tersimpan per tamu
            </dt>
            <dd className="num mt-1 text-sm font-semibold text-slate-900">
              {persistedUnitPriceLabel}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Pax</dt>
            <dd className="num mt-1 text-sm font-semibold text-slate-900">
              {pax} tamu
            </dd>
          </div>
        </dl>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Fleksibilitas Menginap
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Biaya tetap per reservasi, bukan per pax atau per malam.
            {inHouse
              ? " Pilihan baru langsung diposting ke folio terbuka."
              : " Pilihan yang menunggu akan diposting satu kali saat check-in."}
          </p>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {stayFees.map((fee) => {
            const statusLabel =
              fee.status === "PENDING"
                ? "Menunggu posting · belum diposting"
                : fee.status === "POSTED"
                  ? "Terposting · terkunci"
                  : fee.status === "CANCELLED"
                    ? "Dibatalkan"
                    : "Belum dipilih";
            const selecting = pendingFeeKind === fee.kind;

            return (
              <article
                key={fee.kind}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {fee.label}
                    </h3>
                    <p className="num mt-1 text-sm text-slate-600">
                      {formatIDR(fee.unitPrice)} · tetap per reservasi
                    </p>
                  </div>
                  {fee.status === "POSTED" ? (
                    <LockKeyhole
                      className="h-4 w-4 shrink-0 text-slate-500"
                      aria-label="Terkunci"
                    />
                  ) : null}
                </div>
                <p className="mt-3 text-xs font-semibold text-slate-600">
                  {statusLabel}
                </p>
                <div className="mt-4">
                  {fee.status === "POSTED" ? (
                    <Button type="button" variant="outline" disabled>
                      Terposting · terkunci
                    </Button>
                  ) : fee.status === "PENDING" ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={terminal || pendingFeeKind !== null}
                      onClick={() => changeStayFee(fee, false)}
                    >
                      {selecting ? "Menyimpan…" : "Hapus Pilihan"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={terminal || pendingFeeKind !== null}
                      onClick={() => changeStayFee(fee, true)}
                    >
                      {selecting ? "Menyimpan…" : "Pilih"}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {!terminal ? (
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">Perubahan Arrangement</h2>
            <p className="mt-1 text-sm text-slate-500">
              {effectiveDateLabel
                ? `Perubahan berlaku mulai ${effectiveDateLabel} untuk ${editableNightCount} malam mendatang yang belum diposting.`
                : "Tidak ada malam mendatang yang dapat diubah."}
            </p>
            <p className="mt-1 text-xs font-medium text-amber-700">
              Malam yang telah lewat atau diposting tidak akan diubah.
            </p>
          </div>
          <div className="p-5">
            <Dialog open={dialogOpen} onOpenChange={changeDialogOpen}>
              <DialogTrigger
                render={<Button type="button" variant="outline" />}
                disabled={editableNightCount === 0 || !effectiveDateLabel || isPending}
              >
                Ubah Arrangement
              </DialogTrigger>
              <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg" showCloseButton={!isPending}>
                <DialogHeader>
                  <DialogTitle>Ubah Arrangement</DialogTitle>
                  <DialogDescription>
                    Perubahan berlaku mulai {effectiveDateLabel}. Malam yang telah
                    lewat atau diposting tetap terkunci dan tidak akan diubah.
                  </DialogDescription>
                </DialogHeader>
                <form
                  className="space-y-4"
                  aria-busy={isPending}
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitChange();
                  }}
                >
                  <label className="block text-sm font-medium text-slate-700">
                    Arrangement baru
                    <select
                      className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      value={selectedPlan}
                      onChange={(event) => {
                        const plan = event.target.value as ArrangementType;
                        setSelectedPlan(plan);
                        setUnitPrice(initialUnitPrice(plan));
                        setError(null);
                      }}
                      disabled={isPending}
                    >
                      {options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.value} — {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedPlan !== "RO" ? (
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Harga satuan (IDR / pax / malam)
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1}
                          required
                          value={unitPrice}
                          onChange={(event) => {
                            setUnitPrice(event.target.value);
                            setError(null);
                          }}
                          disabled={isPending}
                          aria-invalid={!validAllocation}
                          aria-describedby="arrangement-price-help"
                          className="num mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                        />
                      </label>
                      <p id="arrangement-price-help" className="mt-2 text-xs text-slate-600">
                        {selectedPlan === currentPlan && editableCurrentPlanPrices.length > 1
                          ? "Harga tersimpan bervariasi. Masukkan harga pengganti untuk seluruh malam yang dapat diubah."
                          : selectedPlan === currentPlan && editableCurrentPlanPrices.length === 1
                            ? "Harga awal menggunakan harga tersimpan pada malam yang dapat diubah."
                            : "Harga awal mengikuti tarif katalog Arrangement yang dipilih."}
                        {" "}Masukkan bilangan bulat nol atau lebih; harga ini disimpan untuk malam yang dapat diubah.
                      </p>
                      {!validAllocation ? (
                        <p role="alert" className="mt-2 text-sm text-red-700">
                          Masukkan harga IDR bulat yang valid, nol atau lebih, dengan total dalam batas angka aman.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4" role="status" aria-live="polite" aria-atomic="true">
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-slate-500">Pax</dt>
                        <dd className="num font-semibold">{pax} tamu</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Malam yang dapat diubah</dt>
                        <dd className="num font-semibold">{editableNightCount} malam</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Alokasi per malam</dt>
                        <dd className="num font-semibold">{validAllocation ? formatIDR(nightlyAllocation) : "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Total alokasi Arrangement</dt>
                        <dd className="num font-semibold">{validAllocation ? formatIDR(totalAllocation) : "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Net kamar untuk malam yang dapat diubah</dt>
                        <dd className="num font-semibold">{validAllocation ? formatIDR(eligiblePackageTotal - totalAllocation) : "—"}</dd>
                      </div>
                    </dl>
                    <p className="mt-3 text-xs text-slate-600">
                      Total alokasi = harga satuan × pax × malam yang dapat diubah.
                      {selectedPlan === "RO" ? " RO tidak memiliki alokasi makan." : ""}
                      {" "}Net kamar = tarif paket kamar − alokasi Arrangement.
                      Tarif paket tersimpan tidak diubah oleh tindakan ini.
                      Alokasi tidak boleh melebihi tarif paket setiap malam.
                      Kelayakan malam dan tarif paket diperiksa ulang saat disimpan.
                    </p>
                  </div>
                  {overAllocatedNight ? (
                    <p role="alert" className="text-sm text-red-700">
                      Alokasi Arrangement {formatIDR(nightlyAllocation)} melebihi tarif paket
                      {" "}{formatIDR(overAllocatedNight.rateAmount)} untuk malam {overAllocatedNight.dateLabel}.
                      Kurangi harga satuan; net kamar tidak boleh negatif.
                    </p>
                  ) : null}
                  {!hasChange && validAllocation ? (
                    <p className="text-sm text-slate-600">
                      Belum ada perubahan. Ubah Arrangement atau harga satuan untuk menyimpan.
                    </p>
                  ) : null}
                  {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
                  <p role="status" className="sr-only">{isPending ? "Menyimpan Arrangement…" : ""}</p>
                  <DialogFooter>
                    <Button type="button" variant="outline" disabled={isPending} onClick={() => changeDialogOpen(false)}>
                      Batal
                    </Button>
                    <Button type="submit" disabled={!canSubmit}>
                      {isPending ? "Menyimpan…" : "Simpan Arrangement"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </section>
      ) : (
        <section className="rounded-lg border border-slate-200 bg-slate-100 px-5 py-4">
          <div className="flex items-start gap-3">
            <LockKeyhole className="mt-0.5 h-4 w-4 text-slate-500" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Riwayat terkunci</h2>
              <p className="mt-1 text-sm text-slate-600">
                Reservasi final hanya menampilkan riwayat Arrangement dan tidak dapat diubah.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Jadwal per Malam</h2>
          <p className="mt-1 text-sm text-slate-500">
            Nilai berikut berasal dari data tersimpan per malam reservasi.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-180 text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-5 py-3">Tanggal</th>
                <th className="px-4 py-3">Arrangement</th>
                <th className="px-4 py-3 text-right">Pax</th>
                <th className="px-4 py-3 text-right">Harga Satuan</th>
                <th className="px-4 py-3 text-right">Jumlah</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {nights.map((night) => (
                <tr key={night.id} className="text-slate-700">
                  <td className="px-5 py-3 font-medium text-slate-900">
                    {night.dateLabel}
                  </td>
                  <td className="px-4 py-3">{night.plan}</td>
                  <td className="num px-4 py-3 text-right">{night.pax}</td>
                  <td className="num px-4 py-3 text-right">
                    {formatIDR(night.unitPrice)}
                  </td>
                  <td className="num px-4 py-3 text-right font-medium text-slate-900">
                    {formatIDR(night.amount)}
                  </td>
                  <td className="px-5 py-3">
                    {night.lockReason === "posted" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        <LockKeyhole className="h-3 w-3" aria-hidden="true" />
                        Diposting · terkunci
                      </span>
                    ) : night.lockReason === "elapsed" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        <LockKeyhole className="h-3 w-3" aria-hidden="true" />
                        Telah lewat · terkunci
                      </span>
                    ) : night.lockReason === "terminal" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        <LockKeyhole className="h-3 w-3" aria-hidden="true" />
                        Reservasi final · terkunci
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                        Dapat diubah
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
