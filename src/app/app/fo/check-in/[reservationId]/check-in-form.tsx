"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState, type BaseSyntheticEvent } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
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
import { formatIDR } from "@/lib/format";
import { completeCheckIn } from "./actions";
import {
  checkInDepositMethods,
  CheckInSchema,
  purposeOfVisitOptions,
  type CheckInDepositMethod,
  type PurposeOfVisitValue,
} from "./schema";

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
  "h-8 rounded-none border-console-border bg-console-surface text-[12px]";
const selectClassName =
  "h-8 w-full rounded-none border border-console-border bg-console-surface px-2 text-[12px] outline-none focus:border-console-ink focus:ring-3 focus:ring-slate-500/20";

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
      className={`flex items-center justify-between py-1 ${
        strong ? "font-semibold" : ""
      }`}
    >
      <span className={strong ? "text-console-ink" : "text-slate-500"}>
        {label}
      </span>
      <span className="num text-right font-medium text-console-ink">
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
    formData.set("arrivalConfirmation", String(values.arrivalConfirmation));
    formData.set("depositAmount", values.depositAmount ?? "");
    formData.set("depositMethod", values.depositMethod ?? "");
    formData.set("depositReference", values.depositReference ?? "");

    const result = await completeCheckIn(formData);

    if (!result.ok) {
      setActionError(resultErrorMessage(result.error));
      toast.error(resultErrorMessage(result.error));
    }
  }

  return (
    <Form {...form}>
      <form
        id="check-in-form"
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]"
      >
        <input
          type="hidden"
          value={reservationId}
          {...form.register("reservationId")}
        />

        <div className="flex min-w-0 flex-col gap-4">
          <section className="border border-console-border bg-console-surface">
            <div className="flex items-center justify-between gap-3 bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
              <h2>1. Pilih Kamar</h2>
              <span className="text-[10px] text-slate-400">
                Tipe: {roomTypeName}
              </span>
            </div>
            <div className="p-3.5">
              <div className="mb-2.5 flex items-center gap-2">
                <select
                  value={floorFilter}
                  onChange={(event) => setFloorFilter(event.target.value)}
                  className="h-8 w-[120px] rounded-none border border-console-border bg-console-surface px-2 text-[12px] outline-none focus:border-console-ink focus:ring-3 focus:ring-slate-500/20"
                >
                  <option value="">Semua lantai</option>
                  {floors.map((floor) => (
                    <option key={floor} value={String(floor)}>
                      Lantai {floor}
                    </option>
                  ))}
                </select>
                <span className="flex-1" />
                <span className="text-[12px] text-slate-500">
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
                            className={`flex h-16 flex-col items-center justify-center gap-0.5 border px-2 text-center disabled:cursor-not-allowed disabled:opacity-45 ${
                              selected
                                ? "border-console-ink bg-console-ink text-white"
                                : "border-console-border bg-console-surface text-console-ink hover:border-console-ink hover:bg-console-bg"
                            }`}
                          >
                            <span className="text-[15px] font-semibold">
                              {room.number}
                            </span>
                            <span className="text-[10px] opacity-80">
                              Lt. {room.floor} · {room.status}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {assignedRoomId ? (
                      <p className="mt-2 text-[11px] text-slate-500">
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

          <section className="border border-console-border bg-console-surface">
            <div className="bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
              {"// GUEST INFORMATION"}
            </div>
            <div className="grid gap-3.5 p-3.5 md:grid-cols-2">
              <FormField
                control={form.control}
                name="guestFullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Tamu</FormLabel>
                    <FormControl>
                      <Input
                        required
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

          <section className="border border-console-border bg-console-surface">
            <div className="bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
              {"// 2. Guest Registration Card (GRC)"}
            </div>
            <div className="grid gap-3.5 p-3.5 md:grid-cols-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                  Nama Lengkap
                </div>
                <div className="mt-1 flex h-8 items-center border border-console-border bg-console-bg px-2 text-[12px] font-medium text-console-ink">
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
                  name="arrivalConfirmation"
                  render={({ field }) => (
                    <FormItem>
                      <label className="flex gap-2 text-[12px] leading-5 text-console-ink">
                        <input
                          type="checkbox"
                          className="mt-1 h-3.5 w-3.5 rounded-none border-console-border"
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

          <section className="border border-console-border bg-console-surface">
            <div className="bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
              {"// 3. Deposit & Pembayaran Awal"}
            </div>
            <div className="grid gap-3.5 p-3.5 md:grid-cols-2">
              {depositNote ? (
                <p className="text-[11px] text-slate-500 md:col-span-2">
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
            <p className="border border-red-500 bg-status-od-bg px-3 py-2 text-[12px] text-status-od-fg">
              {actionError ?? form.formState.errors.root?.message}
            </p>
          ) : null}
        </div>

        <aside className="min-w-0">
          <section className="border border-console-border bg-console-surface">
            <div className="bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
              {"// Ringkasan"}
            </div>
            <div className="p-3.5 text-[13px]">
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
              <div className="my-2 border-t border-console-border-soft" />
              <SummaryRow label="Subtotal kamar" value={formatIDR(totalStay)} />
              <SummaryRow
                label="Deposit awal"
                value={formatIDR(
                  Number.isFinite(depositAmount) ? depositAmount : 0,
                )}
              />
            </div>
            <div className="border-t border-console-border bg-console-bg px-3.5 py-3 text-[12px] text-slate-600">
              Folio akan otomatis dibuka setelah check-in.
            </div>
          </section>
        </aside>
      </form>
    </Form>
  );
}
