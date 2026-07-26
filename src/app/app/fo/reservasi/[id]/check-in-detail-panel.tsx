"use client";

import { DepositStatus, ReservationStatus } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { SignaturePadField } from "@/components/check-in/signature-pad-field";
import { DepositStatusBadge } from "@/components/deposit-status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { collectCheckInDeposit, completeCheckIn } from "@/lib/check-in/actions";
import {
  checkInDepositMethods,
  purposeOfVisitOptions,
  type CheckInDepositMethod,
  type PurposeOfVisitValue,
} from "@/lib/check-in/schema";
import { formatIDR } from "@/lib/format";
import { getFreshCheckInReview } from "./actions";

type FreshReviewResult = Awaited<ReturnType<typeof getFreshCheckInReview>>;
type CheckInReview = Extract<FreshReviewResult, { ok: true }>["review"];

type CheckInDetailPanelProps = {
  initialReview: CheckInReview;
};

type CheckInDetailAffordanceProps = {
  intent: "deposit" | "review";
  label: string;
  variant?: "default" | "outline";
};

const selectClassName =
  "h-11 desktop:h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";
const fieldClassName =
  "h-11 desktop:h-10 rounded-md border-slate-300 bg-white text-sm focus:border-emerald-500 focus:ring-emerald-500";

function ReadOnlyItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 wrap-break-word text-sm font-medium text-slate-900">
        {value || "—"}
      </dd>
    </div>
  );
}

function reviewKey(review: CheckInReview) {
  return JSON.stringify(review);
}

export function CheckInDetailAffordance({
  intent,
  label,
  variant = "default",
}: CheckInDetailAffordanceProps) {
  function activateDetailFlow() {
    const reviewButton = document.getElementById("check-in-detail-review-button");

    if (
      intent === "review" &&
      reviewButton instanceof HTMLButtonElement &&
      !reviewButton.disabled
    ) {
      reviewButton.click();
      return;
    }

    const step = document.getElementById(
      intent === "deposit"
        ? "check-in-detail-deposit"
        : "check-in-detail-purpose",
    );
    const control = document.getElementById(
      intent === "deposit"
        ? "check-in-detail-deposit-method"
        : "check-in-detail-purpose-select",
    );

    step?.scrollIntoView({ behavior: "smooth", block: "center" });
    control?.focus({ preventScroll: true });
  }

  return (
    <Button type="button" variant={variant} onClick={activateDetailFlow}>
      {label}
    </Button>
  );
}

export function CheckInDetailPanel({
  initialReview,
}: CheckInDetailPanelProps) {
  const router = useRouter();
  const [review, setReview] = useState<CheckInReview | null>(null);
  const [depositPayment, setDepositPayment] = useState<{
    amount: string;
    method: string;
    reference: string | null;
  } | null>(initialReview.deposit.payment);
  const [depositStatus, setDepositStatus] = useState(
    initialReview.deposit.status,
  );
  const [depositMethod, setDepositMethod] = useState<
    CheckInDepositMethod | ""
  >("");
  const [depositReference, setDepositReference] = useState("");
  const [purposeOfVisit, setPurposeOfVisit] = useState<
    PurposeOfVisitValue | ""
  >("");
  const [purposeOfVisitOther, setPurposeOfVisitOther] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [arrivalConfirmation, setArrivalConfirmation] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [isCollectingDeposit, setIsCollectingDeposit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const purposeReady =
    purposeOfVisit !== "" &&
    (purposeOfVisit !== "Lainnya" || purposeOfVisitOther.trim().length > 0);
  const statusReady = initialReview.status === ReservationStatus.CONFIRMED;
  const depositReady =
    depositStatus === DepositStatus.COLLECTED && Boolean(depositPayment);
  const roomReady = initialReview.roomReady;
  const canOpenReview =
    statusReady &&
    initialReview.arrivalDue &&
    depositReady &&
    roomReady &&
    purposeReady;
  const canCollectDeposit =
    statusReady &&
    initialReview.arrivalDue &&
    initialReview.deposit.status === DepositStatus.PENDING &&
    !depositPayment;

  async function collectDeposit() {
    setDepositError(null);

    if (!depositMethod) {
      setDepositError("Pilih metode pembayaran deposit.");
      return;
    }

    if (depositMethod === "TRANSFER" && !depositReference.trim()) {
      setDepositError("Referensi deposit wajib diisi untuk transfer.");
      return;
    }

    setIsCollectingDeposit(true);
    const formData = new FormData();
    formData.set("reservationId", String(initialReview.reservationId));
    formData.set("depositMethod", depositMethod);
    formData.set("depositReference", depositReference);

    try {
      const result = await collectCheckInDeposit(formData);

      if (!result.ok) {
        setDepositError(result.error);
        toast.error(result.error);
        return;
      }

      setDepositPayment(result.payment);
      setDepositStatus(DepositStatus.COLLECTED);
      toast.success(
        result.alreadyCollected
          ? "Deposit sebelumnya sudah tercatat."
          : "Deposit berhasil dikumpulkan.",
      );
      router.refresh();
    } finally {
      setIsCollectingDeposit(false);
    }
  }

  async function openReview() {
    if (!canOpenReview) return;

    setReviewError(null);
    setSignatureDataUrl("");
    setArrivalConfirmation(false);
    setReview(null);
    setIsDialogOpen(true);
    setIsLoadingReview(true);

    try {
      const result = await getFreshCheckInReview(initialReview.reservationId);

      if (!result.ok) {
        setReviewError(result.error);
        return;
      }

      setReview(result.review);
      if (
        result.review.status !== ReservationStatus.CONFIRMED ||
        !result.review.arrivalDue ||
        result.review.deposit.status !== DepositStatus.COLLECTED ||
        !result.review.deposit.payment ||
        !result.review.roomReady
      ) {
        setReviewError(
          "Kelayakan check-in berubah. Tutup popup, muat ulang halaman, lalu periksa status reservasi.",
        );
      }
    } finally {
      setIsLoadingReview(false);
    }
  }

  async function submitCheckIn() {
    if (!review) return;

    if (!signatureDataUrl) {
      setReviewError("Tanda tangan tamu wajib diisi.");
      return;
    }

    if (!arrivalConfirmation) {
      setReviewError("Konfirmasi kedatangan tamu wajib dicentang.");
      return;
    }

    setIsSubmitting(true);
    setReviewError(null);

    try {
      const freshResult = await getFreshCheckInReview(
        initialReview.reservationId,
      );

      if (!freshResult.ok) {
        setReviewError(freshResult.error);
        return;
      }

      if (
        freshResult.review.status !== ReservationStatus.CONFIRMED ||
        !freshResult.review.arrivalDue ||
        freshResult.review.deposit.status !== DepositStatus.COLLECTED ||
        !freshResult.review.deposit.payment ||
        !freshResult.review.roomReady
      ) {
        setReview(freshResult.review);
        setSignatureDataUrl("");
        setArrivalConfirmation(false);
        setReviewError(
          "Reservasi tidak lagi memenuhi syarat check-in. Muat ulang halaman dan periksa statusnya.",
        );
        return;
      }

      if (reviewKey(freshResult.review) !== reviewKey(review)) {
        setReview(freshResult.review);
        setSignatureDataUrl("");
        setArrivalConfirmation(false);
        setReviewError(
          "Data reservasi berubah. Ringkasan telah dimuat ulang; minta tamu meninjau dan menandatangani kembali.",
        );
        return;
      }

      const formData = new FormData();
      formData.set("reservationId", String(review.reservationId));
      formData.set("roomId", String(review.room?.id ?? ""));
      formData.set("guestFullName", review.guest.fullName);
      formData.set("guestIdNumber", review.guest.idNumber ?? "");
      formData.set("guestPhone", review.guest.phone ?? "");
      formData.set("guestEmail", review.guest.email ?? "");
      formData.set("guestNationality", review.guest.nationality ?? "");
      formData.set("purposeOfVisit", purposeOfVisit);
      formData.set("purposeOfVisitOther", purposeOfVisitOther);
      formData.set("signatureDataUrl", signatureDataUrl);
      formData.set("arrivalConfirmation", String(arrivalConfirmation));
      formData.set("depositMethod", review.deposit.payment?.method ?? "");
      formData.set(
        "depositReference",
        review.deposit.payment?.reference ?? "",
      );

      const result = await completeCheckIn(formData);

      if (!result.ok) {
        setReviewError(result.error);
        toast.error(result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const guidance = !statusReady
    ? "Reservasi harus berstatus CONFIRMED."
    : !initialReview.arrivalDue
      ? "Check-in baru tersedia pada tanggal kedatangan."
      : !depositReady
        ? "Kumpulkan deposit terlebih dahulu."
        : !roomReady
          ? "Tetapkan kamar yang sesuai dan tersedia melalui Edit Reservasi."
          : !purposeReady
            ? "Pilih tujuan kunjungan sebelum membuka GRC."
            : "Semua persiapan lengkap. Buka GRC untuk ditinjau dan ditandatangani tamu.";

  return (
    <>
      <section
        id="check-in-detail-panel"
        className="mb-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
      >
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Check-in dari detail reservasi
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Kumpulkan deposit, tentukan tujuan kunjungan, lalu minta tamu
            meninjau dan menandatangani GRC.
          </p>
        </div>

        <div className="grid gap-5 p-5 desktop:lg:grid-cols-3">
          <div id="check-in-detail-deposit" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">1. Deposit</h3>
              <DepositStatusBadge
                status={
                  depositPayment ? DepositStatus.COLLECTED : depositStatus
                }
              />
            </div>
            <p className="text-sm text-slate-600">
              Wajib: {formatIDR(initialReview.deposit.requiredAmount ?? 0)}
              {" "}(tarif malam pertama)
            </p>

            {depositPayment ? (
              <dl className="grid grid-cols-2 gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3">
                <ReadOnlyItem label="Metode" value={depositPayment.method} />
                <ReadOnlyItem
                  label="Referensi"
                  value={depositPayment.reference ?? "—"}
                />
              </dl>
            ) : canCollectDeposit ? (
              <div className="space-y-3">
                <label className="block text-xs font-medium text-slate-700">
                  Metode pembayaran
                  <select
                    id="check-in-detail-deposit-method"
                    value={depositMethod}
                    onChange={(event) =>
                      setDepositMethod(
                        event.target.value as CheckInDepositMethod | "",
                      )
                    }
                    className={`${selectClassName} mt-1`}
                  >
                    <option value="">Pilih metode</option>
                    {checkInDepositMethods.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-medium text-slate-700">
                  Referensi{depositMethod === "TRANSFER" ? " (wajib)" : ""}
                  <Input
                    value={depositReference}
                    onChange={(event) => setDepositReference(event.target.value)}
                    className={`${fieldClassName} mt-1`}
                    placeholder="Nomor transaksi / referensi"
                  />
                </label>
                {depositError ? (
                  <p className="text-xs font-medium text-red-600" role="alert">
                    {depositError}
                  </p>
                ) : null}
                <Button
                  type="button"
                  onClick={collectDeposit}
                  disabled={isCollectingDeposit}
                >
                  {isCollectingDeposit
                    ? "Mencatat Deposit..."
                    : "Kumpulkan Deposit"}
                </Button>
              </div>
            ) : (
              <p className="text-xs font-medium text-amber-700">
                Deposit belum dapat dikumpulkan untuk status/tanggal ini.
              </p>
            )}
          </div>

          <div id="check-in-detail-purpose" className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">
              2. Kamar & tujuan
            </h3>
            <div
              className={`rounded-md border p-3 text-sm ${
                roomReady
                  ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                  : "border-amber-200 bg-amber-50 text-amber-950"
              }`}
            >
              <p className="font-semibold">
                {roomReady
                  ? `Kamar ${initialReview.room?.number} siap`
                  : "Kamar belum siap untuk check-in"}
              </p>
              <p className="mt-1 text-xs">
                {roomReady
                  ? `${initialReview.room?.typeName} · valid untuk seluruh periode menginap`
                  : "Gunakan Edit Reservasi untuk menetapkan kamar dengan tipe yang sesuai, tidak OOO, dan tanpa bentrok periode menginap."}
              </p>
              {!roomReady && statusReady ? (
                <Link
                  href={`/app/fo/reservasi/${initialReview.reservationId}?tab=details&mode=edit`}
                  className={buttonVariants({
                    variant: "outline",
                    className: "mt-3",
                  })}
                >
                  Edit Reservasi
                </Link>
              ) : null}
            </div>

            <label className="block text-xs font-medium text-slate-700">
              Tujuan kunjungan
              <select
                id="check-in-detail-purpose-select"
                value={purposeOfVisit}
                onChange={(event) =>
                  setPurposeOfVisit(
                    event.target.value as PurposeOfVisitValue | "",
                  )
                }
                className={`${selectClassName} mt-1`}
              >
                <option value="">Pilih tujuan kunjungan</option>
                {purposeOfVisitOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            {purposeOfVisit === "Lainnya" ? (
              <label className="block text-xs font-medium text-slate-700">
                Detail tujuan
                <Input
                  value={purposeOfVisitOther}
                  onChange={(event) =>
                    setPurposeOfVisitOther(event.target.value)
                  }
                  className={`${fieldClassName} mt-1`}
                  placeholder="Tuliskan tujuan kunjungan"
                />
              </label>
            ) : null}
          </div>

          <div className="flex flex-col justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                3. Review & tanda tangan
              </h3>
              <p className="mt-2 text-sm text-slate-600">{guidance}</p>
              <p className="mt-2 text-xs text-slate-500">
                Status tombol hanya panduan. Validasi dan transaksi server tetap
                menentukan hasil check-in.
              </p>
            </div>
            <Button
              id="check-in-detail-review-button"
              type="button"
              disabled={!canOpenReview}
              onClick={openReview}
            >
              Review & Tanda Tangani GRC
            </Button>
          </div>
        </div>
      </section>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!isSubmitting) setIsDialogOpen(open);
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Review & tanda tangani GRC</DialogTitle>
            <DialogDescription>
              Data berikut dimuat ulang dari server saat popup dibuka. Edit data
              tamu melalui Edit Reservasi, bukan dari popup ini.
            </DialogDescription>
          </DialogHeader>

          {isLoadingReview ? (
            <div className="space-y-3 py-6" aria-busy="true">
              <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-32 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-40 animate-pulse rounded-lg bg-slate-100" />
            </div>
          ) : review ? (
            <div className="space-y-4">
              <section className="rounded-lg border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Reservasi & tamu
                </h3>
                <dl className="mt-3 grid gap-4 sm:grid-cols-3">
                  <ReadOnlyItem label="No. reservasi" value={review.reservationNo} />
                  <ReadOnlyItem label="Tipe" value={review.reservationType} />
                  <ReadOnlyItem label="Arrangement" value={review.arrangementType} />
                  <ReadOnlyItem label="Nama tamu" value={review.guest.fullName} />
                  <ReadOnlyItem label="No. identitas" value={review.guest.idNumber ?? "—"} />
                  <ReadOnlyItem label="Telepon" value={review.guest.phone ?? "—"} />
                  <ReadOnlyItem label="Email" value={review.guest.email ?? "—"} />
                  <ReadOnlyItem label="Kebangsaan" value={review.guest.nationality ?? "—"} />
                </dl>
              </section>

              <section className="rounded-lg border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Masa menginap
                </h3>
                <dl className="mt-3 grid gap-4 sm:grid-cols-4">
                  <ReadOnlyItem label="Kedatangan" value={review.stay.arrivalLabel} />
                  <ReadOnlyItem label="Keberangkatan" value={review.stay.departureLabel} />
                  <ReadOnlyItem label="Malam" value={String(review.stay.nights)} />
                  <ReadOnlyItem label="Tamu" value={`${review.stay.adults} dewasa · ${review.stay.children} anak`} />
                  <ReadOnlyItem label="Kamar" value={review.room ? `${review.room.number} · ${review.room.typeName}` : "Belum ditetapkan"} />
                  <ReadOnlyItem label="Total menginap" value={formatIDR(review.stay.total)} />
                  <ReadOnlyItem label="Deposit wajib" value={formatIDR(review.deposit.requiredAmount ?? 0)} />
                  <ReadOnlyItem label="Status deposit" value={review.deposit.status} />
                  <ReadOnlyItem label="Metode deposit" value={review.deposit.payment?.method ?? "—"} />
                  <ReadOnlyItem label="Referensi deposit" value={review.deposit.payment?.reference ?? "—"} />
                </dl>
                {review.stay.nightlySchedule.length > 0 ? (
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <p className="text-xs font-semibold text-slate-600">Tarif per malam</p>
                    <ul className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
                      {review.stay.nightlySchedule.map((night) => (
                        <li key={night.dateLabel} className="flex justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
                          <span>{night.dateLabel}</span>
                          <span className="font-medium text-slate-900">{formatIDR(night.rateAmount)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>

              <section className="rounded-lg border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Persetujuan tamu
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Tujuan kunjungan: {purposeOfVisit === "Lainnya" ? purposeOfVisitOther : purposeOfVisit}
                </p>
                <div className="mt-4">
                  <label className="text-sm font-medium text-slate-800">
                    Tanda tangan tamu
                  </label>
                  <div className="mt-2">
                    <SignaturePadField
                      value={signatureDataUrl}
                      onChange={setSignatureDataUrl}
                    />
                  </div>
                </div>
                <label className="mt-4 flex cursor-pointer gap-2 text-sm leading-5 text-slate-800">
                  <input
                    type="checkbox"
                    checked={arrivalConfirmation}
                    onChange={(event) =>
                      setArrivalConfirmation(event.target.checked)
                    }
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>
                    Saya mengonfirmasi data di atas sudah benar dan tamu sudah
                    hadir secara fisik.
                  </span>
                </label>
              </section>
            </div>
          ) : null}

          {reviewError ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert">
              {reviewError}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={submitCheckIn}
              disabled={
                isLoadingReview ||
                isSubmitting ||
                !review ||
                review.status !== ReservationStatus.CONFIRMED ||
                !review.arrivalDue ||
                !review.roomReady ||
                review.deposit.status !== DepositStatus.COLLECTED ||
                !review.deposit.payment ||
                !signatureDataUrl ||
                !arrivalConfirmation
              }
            >
              {isSubmitting ? "Memproses..." : "Konfirmasi Check-In"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
