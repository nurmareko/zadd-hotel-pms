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
      ? "Unavailable"
      : persistedUnitPrices.length > 1
        ? "Varies by night"
        : `${formatIDR(persistedUnitPrices[0])} / night`;
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
        `Remove selection ${fee.label}? The selection history will be retained with Cancelled status.`,
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
          ? `${fee.label} posted immediately to the open folio.`
          : result.status === "PENDING"
            ? `${fee.label} saved and awaiting posting at check-in.`
            : `${fee.label} cancelled; selection history retained.`,
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
          `Arrangement updated from ${result.effectiveDate} for ${result.changedNights} nights.`,
        );
        setDialogOpen(false);
        router.refresh();
      } catch {
        setError("Unable to confirm whether the changes were saved. Reload to check the arrangement before trying again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Current Arrangement</h2>
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
              Saved price per guest
            </dt>
            <dd className="num mt-1 text-sm font-semibold text-slate-900">
              {persistedUnitPriceLabel}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Pax</dt>
            <dd className="num mt-1 text-sm font-semibold text-slate-900">
              {pax} guests
            </dd>
          </div>
        </dl>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Stay Flexibility
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Fixed fees per reservation, not per guest or per night.
            {inHouse
              ? " New selections are posted immediately to the open folio."
              : " Pending selections will be posted once at check-in."}
          </p>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {stayFees.map((fee) => {
            const statusLabel =
              fee.status === "PENDING"
                ? "Pending posting · not yet posted"
                : fee.status === "POSTED"
                  ? "Posted · locked"
                  : fee.status === "CANCELLED"
                    ? "Cancelled"
                    : "Not selected";
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
                      {formatIDR(fee.unitPrice)} · fixed per reservation
                    </p>
                  </div>
                  {fee.status === "POSTED" ? (
                    <LockKeyhole
                      className="h-4 w-4 shrink-0 text-slate-500"
                      aria-label="Locked"
                    />
                  ) : null}
                </div>
                <p className="mt-3 text-xs font-semibold text-slate-600">
                  {statusLabel}
                </p>
                <div className="mt-4">
                  {fee.status === "POSTED" ? (
                    <Button type="button" variant="outline" disabled>
                      Posted · locked
                    </Button>
                  ) : fee.status === "PENDING" ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={terminal || pendingFeeKind !== null}
                      onClick={() => changeStayFee(fee, false)}
                    >
                      {selecting ? "Saving…" : "Remove Selection"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={terminal || pendingFeeKind !== null}
                      onClick={() => changeStayFee(fee, true)}
                    >
                      {selecting ? "Saving…" : "Select"}
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
            <h2 className="text-base font-semibold text-slate-900">Arrangement Changes</h2>
            <p className="mt-1 text-sm text-slate-500">
              {effectiveDateLabel
                ? `Changes apply from ${effectiveDateLabel} for ${editableNightCount} upcoming unposted nights.`
                : "There are no upcoming nights that can be changed."}
            </p>
            <p className="mt-1 text-xs font-medium text-amber-700">
              Past or posted nights will not be changed.
            </p>
          </div>
          <div className="p-5">
            <Dialog open={dialogOpen} onOpenChange={changeDialogOpen}>
              <DialogTrigger
                render={<Button type="button" variant="outline" />}
                disabled={editableNightCount === 0 || !effectiveDateLabel || isPending}
              >
                Change Arrangement
              </DialogTrigger>
              <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg" showCloseButton={!isPending}>
                <DialogHeader>
                  <DialogTitle>Change Arrangement</DialogTitle>
                  <DialogDescription>
                    Changes apply from {effectiveDateLabel}. Past or posted nights remain locked and will not be changed.
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
                    New arrangement
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
                        Unit price (IDR / guest / night)
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
                          ? "Saved prices vary. Enter a replacement price for all eligible nights."
                          : selectedPlan === currentPlan && editableCurrentPlanPrices.length === 1
                            ? "The initial price uses the saved price for eligible nights."
                            : "The initial price follows the catalogue rate for the selected arrangement."}
                        {" "}Enter a whole number of zero or more; this price will be saved for eligible nights.
                      </p>
                      {!validAllocation ? (
                        <p role="alert" className="mt-2 text-sm text-red-700">
                          Enter a valid whole-number IDR price of zero or more, with a total within the safe numeric range.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4" role="status" aria-live="polite" aria-atomic="true">
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-slate-500">Pax</dt>
                        <dd className="num font-semibold">{pax} guests</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Eligible Nights</dt>
                        <dd className="num font-semibold">{editableNightCount} nights</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Allocation per night</dt>
                        <dd className="num font-semibold">{validAllocation ? formatIDR(nightlyAllocation) : "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Total arrangement allocation</dt>
                        <dd className="num font-semibold">{validAllocation ? formatIDR(totalAllocation) : "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Net room amount for eligible nights</dt>
                        <dd className="num font-semibold">{validAllocation ? formatIDR(eligiblePackageTotal - totalAllocation) : "—"}</dd>
                      </div>
                    </dl>
                    <p className="mt-3 text-xs text-slate-600">
                      Total allocation = unit price × guests × eligible nights.
                      {selectedPlan === "RO" ? " RO has no meal allocation." : ""}
                      {" "}Net room amount = room package rate − arrangement allocation. This action does not change the saved package rate. The allocation must not exceed the package rate for any night. Night eligibility and package rates are rechecked when saving.
                    </p>
                  </div>
                  {overAllocatedNight ? (
                    <p role="alert" className="text-sm text-red-700">
                      Arrangement allocation {formatIDR(nightlyAllocation)} exceeds the package rate
                      {" "}{formatIDR(overAllocatedNight.rateAmount)} for the night of {overAllocatedNight.dateLabel}. Reduce the unit price; the net room amount cannot be negative.
                    </p>
                  ) : null}
                  {!hasChange && validAllocation ? (
                    <p className="text-sm text-slate-600">
                      No changes yet. Change the arrangement or unit price to save.
                    </p>
                  ) : null}
                  {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
                  <p role="status" className="sr-only">{isPending ? "Saving Arrangement…" : ""}</p>
                  <DialogFooter>
                    <Button type="button" variant="outline" disabled={isPending} onClick={() => changeDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={!canSubmit}>
                      {isPending ? "Saving…" : "Save Arrangement"}
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
              <h2 className="text-sm font-semibold text-slate-800">Locked History</h2>
              <p className="mt-1 text-sm text-slate-600">
                Finalised reservations only display arrangement history and cannot be changed.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Nightly Schedule</h2>
          <p className="mt-1 text-sm text-slate-500">
            These values come from the saved data for each reservation night.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-180 text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-4 py-3">Arrangement</th>
                <th className="px-4 py-3 text-right">Pax</th>
                <th className="px-4 py-3 text-right">Unit Price</th>
                <th className="px-4 py-3 text-right">Amount</th>
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
                        Posted · locked
                      </span>
                    ) : night.lockReason === "elapsed" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        <LockKeyhole className="h-3 w-3" aria-hidden="true" />
                        Past · locked
                      </span>
                    ) : night.lockReason === "terminal" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        <LockKeyhole className="h-3 w-3" aria-hidden="true" />
                        Finalised reservation · locked
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                        Editable
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
