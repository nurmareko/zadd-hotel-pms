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
import { formatIDR } from "@/lib/format";
import {
  changeReservationMealPlan,
  setReservationStayFee,
} from "./actions";

type InclusionNight = {
  id: string;
  dateLabel: string;
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
  currentUnitPrice: string;
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
  currentUnitPrice,
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
  const [isPending, startTransition] = useTransition();
  const [pendingFeeKind, setPendingFeeKind] =
    useState<ReservationStayFeeKind | null>(null);
  const selectedOption = options.find((option) => option.value === selectedPlan);
  const canSubmit =
    !terminal &&
    editableNightCount > 0 &&
    selectedPlan !== currentPlan &&
    !isPending;

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

    const confirmed = window.confirm(
      `Ubah meal plan menjadi ${selectedOption.label}? Perubahan berlaku mulai ${effectiveDateLabel} untuk ${editableNightCount} malam mendatang yang belum diposting. Malam yang telah lewat atau diposting tetap terkunci.`,
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const result = await changeReservationMealPlan({
        reservationId,
        arrangementType: selectedPlan,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(
        `Meal plan diperbarui mulai ${result.effectiveDate} untuk ${result.changedNights} malam.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Inklusi Saat Ini</h2>
        </div>
        <dl className="grid gap-4 p-5 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium text-slate-500">Meal plan</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">
              {currentPlanLabel}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Harga per tamu</dt>
            <dd className="num mt-1 text-sm font-semibold text-slate-900">
              {formatIDR(currentUnitPrice)} / malam
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
            Biaya flat per reservasi, bukan per pax atau per malam.
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
                      {formatIDR(fee.unitPrice)} · flat per reservasi
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
            <h2 className="text-base font-semibold text-slate-900">Ubah Meal Plan</h2>
            <p className="mt-1 text-sm text-slate-500">
              {effectiveDateLabel
                ? `Perubahan berlaku mulai ${effectiveDateLabel} untuk ${editableNightCount} malam mendatang yang belum diposting.`
                : "Tidak ada malam mendatang yang dapat diubah."}
            </p>
            <p className="mt-1 text-xs font-medium text-amber-700">
              Malam yang telah lewat atau diposting tidak akan diubah.
            </p>
          </div>
          <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm font-medium text-slate-700">
              Meal plan baru
              <select
                className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                value={selectedPlan}
                onChange={(event) =>
                  setSelectedPlan(event.target.value as ArrangementType)
                }
                disabled={editableNightCount === 0 || isPending}
              >
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} — {formatIDR(option.unitPrice)} / tamu / malam
                  </option>
                ))}
              </select>
            </label>
            <Button type="button" onClick={submitChange} disabled={!canSubmit}>
              {isPending ? "Menyimpan…" : "Terapkan Perubahan"}
            </Button>
          </div>
        </section>
      ) : (
        <section className="rounded-lg border border-slate-200 bg-slate-100 px-5 py-4">
          <div className="flex items-start gap-3">
            <LockKeyhole className="mt-0.5 h-4 w-4 text-slate-500" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Riwayat terkunci</h2>
              <p className="mt-1 text-sm text-slate-600">
                Reservasi terminal hanya menampilkan riwayat Inklusi dan tidak dapat diubah.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Jadwal per Malam</h2>
          <p className="mt-1 text-sm text-slate-500">
            Nilai berikut berasal dari snapshot malam reservasi di server.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-180 text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-5 py-3">Tanggal</th>
                <th className="px-4 py-3">Plan</th>
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
