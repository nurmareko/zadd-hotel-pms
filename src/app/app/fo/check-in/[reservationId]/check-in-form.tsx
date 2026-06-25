"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState, type BaseSyntheticEvent } from "react";
import {
  useForm,
  useWatch,
  type FieldPath,
  type Resolver,
} from "react-hook-form";
import { toast } from "sonner";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { focusFirstFormError } from "@/lib/form-error-focus";
import { formatIDR } from "@/lib/format";
import { completeCheckIn } from "./actions";
import {
  checkInDepositMethods,
  CheckInSchema,
  purposeOfVisitOptions,
  type CheckInDepositMethod,
  type PurposeOfVisitValue,
} from "./schema";
import { SignaturePadField } from "./signature-pad-field";

type RoomOption = {
  id: number;
  number: string;
  floor: number;
  status: string;
  isAvailable: boolean;
};

type CheckInFormValues = {
  reservationId: number;
  roomId: string;
  guestFullName: string;
  guestIdNumber: string;
  guestPhone: string;
  guestEmail: string;
  guestNationality: string;
  purposeOfVisit: PurposeOfVisitValue;
  purposeOfVisitOther: string;
  signatureDataUrl: string;
  arrivalConfirmation: boolean;
  depositAmount: string;
  depositMethod: CheckInDepositMethod | "";
  depositReference: string;
};

type CheckInFormProps = {
  reservationId: number;
  reservationNo: string;
  guest: {
    fullName: string;
    idNumber: string | null;
    phone: string | null;
    email: string | null;
    nationality: string | null;
  };
  roomTypeName: string;
  arrivalLabel: string;
  departureLabel: string;
  nights: number;
  totalStay: number;
  assignedRoomId: number | null;
  assignedRoomNumber: string | null;
  existingDeposit: string;
  availableRoomsCount: number;
  roomOptions: RoomOption[];
};

const fieldClassName =
  "h-9 rounded-md border-slate-300 bg-white text-sm focus:border-emerald-500 focus:ring-emerald-500";
const selectClassName =
  "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors";

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
      className={`flex items-center justify-between py-1.5 ${
        strong ? "font-semibold text-slate-900" : "text-sm text-slate-500"
      }`}
    >
      <span>
        {label}
      </span>
      <span className="text-right font-medium text-slate-900">
        {value}
      </span>
    </div>
  );
}

function resultErrorMessage(error: unknown) {
  if (typeof error === "string") {
    return error;
  }

  return "Unable to complete check-in";
}

export function CheckInForm({
  reservationId,
  reservationNo,
  guest,
  roomTypeName,
  arrivalLabel,
  departureLabel,
  nights,
  totalStay,
  assignedRoomId,
  assignedRoomNumber,
  existingDeposit,
  availableRoomsCount,
  roomOptions,
}: CheckInFormProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [floorFilter, setFloorFilter] = useState("");
  const [formElement, setFormElement] = useState<HTMLFormElement | null>(null);
  const form = useForm<CheckInFormValues>({
    resolver: zodResolver(CheckInSchema) as unknown as Resolver<
      CheckInFormValues
    >,
    mode: "onChange",
    defaultValues: {
      reservationId,
      roomId: assignedRoomId ? String(assignedRoomId) : "",
      guestFullName: guest.fullName,
      guestIdNumber: guest.idNumber ?? "",
      guestPhone: guest.phone ?? "",
      guestEmail: guest.email ?? "",
      guestNationality: guest.nationality ?? "",
      purposeOfVisit: "Bisnis",
      purposeOfVisitOther: "",
      signatureDataUrl: "",
      arrivalConfirmation: false,
      depositAmount: Number(existingDeposit) > 0 ? existingDeposit : "",
      depositMethod: "",
      depositReference: "",
    },
  });

  const [
    purposeOfVisit,
    depositMethod,
    depositAmountValue,
    selectedRoomId,
    guestFullName,
  ] = useWatch({
    control: form.control,
    name: [
      "purposeOfVisit",
      "depositMethod",
      "depositAmount",
      "roomId",
      "guestFullName",
    ],
  });
  const depositAmount = Number(depositAmountValue || 0);
  const guestName = guestFullName || guest.fullName;
  const selectedRoom = roomOptions.find(
    (room) => String(room.id) === selectedRoomId,
  );
  const floors = Array.from(new Set(roomOptions.map((room) => room.floor))).sort(
    (a, b) => a - b,
  );
  const filteredRoomOptions = floorFilter
    ? roomOptions.filter((room) => String(room.floor) === floorFilter)
    : roomOptions;

  const depositNote = useMemo(() => {
    if (Number(existingDeposit) <= 0) {
      return null;
    }

    return `Deposit ${formatIDR(existingDeposit)} was recorded at booking. Confirm or update.`;
  }, [existingDeposit]);
  const isSubmitting = form.formState.isSubmitting;

  function onInvalid() {
    focusFirstFormError(formElement);
  }

  async function onSubmit(
    values: CheckInFormValues,
    event?: BaseSyntheticEvent,
  ) {
    setActionError(null);
    const formElement =
      event?.currentTarget instanceof HTMLFormElement
        ? event.currentTarget
        : null;
    const formData = formElement ? new FormData(formElement) : new FormData();

    formData.set("reservationId", String(values.reservationId));
    formData.set("roomId", String(formData.get("roomId") || values.roomId));
    formData.set("guestFullName", values.guestFullName);
    formData.set("guestIdNumber", values.guestIdNumber ?? "");
    formData.set("guestPhone", values.guestPhone ?? "");
    formData.set("guestEmail", values.guestEmail ?? "");
    formData.set("guestNationality", values.guestNationality ?? "");
    formData.set("purposeOfVisit", values.purposeOfVisit);
    formData.set("purposeOfVisitOther", values.purposeOfVisitOther ?? "");
    formData.set("signatureDataUrl", values.signatureDataUrl);
    formData.set("arrivalConfirmation", String(values.arrivalConfirmation));
    formData.set("depositAmount", values.depositAmount ?? "");
    formData.set("depositMethod", values.depositMethod ?? "");
    formData.set("depositReference", values.depositReference ?? "");

    const result = await completeCheckIn(formData);

    if (!result.ok) {
      if (result.field) {
        form.setError(
          result.field as FieldPath<CheckInFormValues>,
          { type: "server", message: result.error },
          { shouldFocus: true },
        );
        focusFirstFormError(formElement);
      }

      setActionError(resultErrorMessage(result.error));
      toast.error(resultErrorMessage(result.error));
    }
  }

  return (
    <Form {...form}>
      <form
        id="check-in-form"
        ref={setFormElement}
        onSubmit={form.handleSubmit(onSubmit, onInvalid)}
        noValidate
        className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]"
      >
        <input
          type="hidden"
          value={reservationId}
          {...form.register("reservationId")}
        />

        <div className="flex min-w-0 flex-col gap-4">
          <section className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 text-slate-700">
              <h2 className="text-sm font-semibold">1. Pilih Kamar</h2>
              <span className="text-xs font-medium text-slate-500">
                Tipe: {roomTypeName}
              </span>
            </div>
            <div className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <select
                  value={floorFilter}
                  onChange={(event) => setFloorFilter(event.target.value)}
                  className="h-9 w-[140px] rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                >
                  <option value="">Semua lantai</option>
                  {floors.map((floor) => (
                    <option key={floor} value={String(floor)}>
                      Lantai {floor}
                    </option>
                  ))}
                </select>
                <span className="flex-1" />
                <span className="text-sm font-medium text-slate-500">
                  {availableRoomsCount} kamar tersedia
                </span>
              </div>

              <FormField
                control={form.control}
                name="roomId"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <input type="hidden" {...field} />
                    </FormControl>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-6">
                      {filteredRoomOptions.map((room) => {
                        const selected = String(room.id) === field.value;

                        return (
                          <button
                            key={room.id}
                            type="button"
                            disabled={!room.isAvailable}
                            onClick={() => field.onChange(String(room.id))}
                            className={`flex h-16 flex-col items-center justify-center gap-0.5 rounded-lg border px-2 text-center disabled:cursor-not-allowed disabled:opacity-45 transition-colors ${
                              selected
                                ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                                : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            <span className="text-base font-semibold">
                              {room.number}
                            </span>
                            <span className="text-xs opacity-80">
                              Lt. {room.floor} · {room.status}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {assignedRoomId ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Room was pre-assigned. You can change it before
                        completing check-in.
                      </p>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 text-sm font-semibold text-slate-700">
              {"GUEST INFORMATION"}
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <FormField
                control={form.control}
                name="guestFullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Tamu</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Nama lengkap tamu"
                        className={fieldClassName}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="guestIdNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nomor Identitas</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="KTP / Paspor"
                        className={fieldClassName}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="guestPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telepon</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Nomor telepon"
                        className={fieldClassName}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="guestEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="nama@email.com"
                        className={fieldClassName}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="guestNationality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kebangsaan</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Indonesia"
                        className={fieldClassName}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 text-sm font-semibold text-slate-700">
              {"2. Guest Registration Card (GRC)"}
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <div>
                <div className="text-xs font-semibold text-slate-500">
                  Nama Lengkap
                </div>
                <div className="mt-1 flex h-9 items-center rounded-md border border-slate-300 bg-slate-50 px-3 text-sm font-medium text-slate-700">
                  {guestName}
                </div>
              </div>

              <FormField
                control={form.control}
                name="purposeOfVisit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tujuan Kunjungan</FormLabel>
                    <FormControl>
                      <select
                        className={selectClassName}
                        {...field}
                        onChange={(event) =>
                          field.onChange(
                            event.target.value as PurposeOfVisitValue,
                          )
                        }
                      >
                        {purposeOfVisitOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {purposeOfVisit === "Lainnya" ? (
                <FormField
                  control={form.control}
                  name="purposeOfVisitOther"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Detail Tujuan</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Tuliskan tujuan kunjungan"
                          className={fieldClassName}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              <div className="md:col-span-2">
                <FormField
                  control={form.control}
                  name="signatureDataUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tanda Tangan Tamu</FormLabel>
                      <FormControl>
                        <SignaturePadField
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="md:col-span-2">
                <FormField
                  control={form.control}
                  name="arrivalConfirmation"
                  render={({ field }) => (
                    <FormItem>
                      <label className="flex gap-2 text-sm leading-5 text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          checked={field.value}
                          onChange={(event) =>
                            field.onChange(event.target.checked)
                          }
                        />
                        <span>
                          Saya konfirmasi data tamu sudah benar dan tamu sudah
                          hadir secara fisik.
                        </span>
                      </label>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 text-sm font-semibold text-slate-700">
              {"3. Deposit & Pembayaran Awal"}
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2">
              {depositNote ? (
                <p className="text-xs text-slate-500 md:col-span-2">
                  {depositNote}
                </p>
              ) : null}

              <FormField
                control={form.control}
                name="depositAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jumlah Deposit</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step={1000}
                        placeholder="0"
                        className={fieldClassName}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {depositAmount > 0 ? (
                <>
                  <FormField
                    control={form.control}
                    name="depositMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Metode</FormLabel>
                        <FormControl>
                          <select
                            className={selectClassName}
                            {...field}
                            onChange={(event) =>
                              field.onChange(
                                event.target.value as CheckInDepositMethod,
                              )
                            }
                          >
                            <option value="">Pilih metode</option>
                            {checkInDepositMethods.map((method) => (
                              <option key={method} value={method}>
                                {method}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="md:col-span-2">
                    <FormField
                      control={form.control}
                      name="depositReference"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Referensi
                            {depositMethod === "TRANSFER" ? " / Required" : ""}
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Nomor transaksi, last-4 kartu, dsb."
                              className={fieldClassName}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              ) : null}
            </div>
          </section>

          {actionError || form.formState.errors.root?.message ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {actionError ?? form.formState.errors.root?.message}
            </p>
          ) : null}
        </div>

        <aside className="min-w-0">
          <section className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 text-sm font-semibold text-slate-700">
              {"Ringkasan"}
            </div>
            <div className="p-5 text-sm">
              <SummaryRow label="Reservasi" value={reservationNo} strong />
              <SummaryRow label="Tamu" value={guestName} />
              <SummaryRow label="Tipe" value={roomTypeName} />
              <SummaryRow
                label="Kamar"
                value={
                  selectedRoom?.number ?? assignedRoomNumber ?? "Belum dipilih"
                }
                strong
              />
              <SummaryRow
                label="Periode"
                value={`${arrivalLabel} → ${departureLabel}`}
              />
              <SummaryRow label="Malam" value={String(nights)} />
              <div className="my-3 border-t border-slate-100" />
              <SummaryRow label="Subtotal kamar" value={formatIDR(totalStay)} />
              <SummaryRow
                label="Deposit awal"
                value={formatIDR(
                  Number.isFinite(depositAmount) ? depositAmount : 0,
                )}
              />
            </div>
            <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500">
              Folio akan otomatis dibuka setelah check-in.
            </div>
            <div className="border-t border-slate-200 bg-white p-5">
              <button
                type="submit"
                disabled={isSubmitting}
                className="h-9 w-full rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 shadow-sm transition-colors disabled:cursor-wait disabled:opacity-70"
              >
                {isSubmitting ? "Memproses..." : "Konfirmasi Check-In"}
              </button>
            </div>
          </section>
        </aside>
      </form>
    </Form>
  );
}
