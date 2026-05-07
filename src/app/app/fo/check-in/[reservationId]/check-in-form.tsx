"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useMemo, useState, type BaseSyntheticEvent } from "react";
import { useForm, type Resolver } from "react-hook-form";
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
  purposeOfVisit: PurposeOfVisitValue;
  purposeOfVisitOther: string;
  arrivalConfirmation: boolean;
  depositAmount: string;
  depositMethod: CheckInDepositMethod | "";
  depositReference: string;
};

type CheckInFormProps = {
  reservationId: number;
  cancelHref: string;
  roomTypeName: string;
  arrivalLabel: string;
  assignedRoomId: number | null;
  existingDeposit: string;
  availableRoomsCount: number;
  roomOptions: RoomOption[];
};

const fieldClassName =
  "h-8 rounded-none border-console-border bg-console-surface text-[12px]";
const selectClassName =
  "h-8 w-full rounded-none border border-console-border bg-console-surface px-2 text-[12px] outline-none focus:border-console-ink focus:ring-3 focus:ring-slate-500/20";

function resultErrorMessage(error: unknown) {
  if (typeof error === "string") {
    return error;
  }

  return "Unable to complete check-in";
}

export function CheckInForm({
  reservationId,
  cancelHref,
  roomTypeName,
  arrivalLabel,
  assignedRoomId,
  existingDeposit,
  availableRoomsCount,
  roomOptions,
}: CheckInFormProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const form = useForm<CheckInFormValues>({
    resolver: zodResolver(CheckInSchema) as unknown as Resolver<CheckInFormValues>,
    mode: "onChange",
    defaultValues: {
      reservationId,
      roomId: assignedRoomId ? String(assignedRoomId) : "",
      purposeOfVisit: "Bisnis",
      purposeOfVisitOther: "",
      arrivalConfirmation: false,
      depositAmount: Number(existingDeposit) > 0 ? existingDeposit : "",
      depositMethod: "",
      depositReference: "",
    },
  });

  const purposeOfVisit = form.watch("purposeOfVisit");
  const depositMethod = form.watch("depositMethod");
  const depositAmount = Number(form.watch("depositAmount") || 0);

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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <input
          type="hidden"
          value={reservationId}
          {...form.register("reservationId")}
        />

        <section className="border border-console-border bg-console-surface">
          <div className="bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
            // Room Assignment
          </div>
          <div className="space-y-3.5 p-3.5">
            <div className="flex flex-col gap-1 text-[11px] text-slate-500">
              <span>
                {availableRoomsCount} {roomTypeName} rooms available for{" "}
                {arrivalLabel}
              </span>
              {assignedRoomId ? (
                <span>
                  Room was pre-assigned. You can change it before completing
                  check-in.
                </span>
              ) : null}
            </div>

            <FormField
              control={form.control}
              name="roomId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Room</FormLabel>
                  <FormControl>
                    <select className={selectClassName} {...field}>
                      <option value="">Select room</option>
                      {roomOptions.map((room) => (
                        <option
                          key={room.id}
                          value={String(room.id)}
                          disabled={!room.isAvailable}
                        >
                          {room.number} / Floor {room.floor}
                          {!room.isAvailable ? ` / ${room.status}` : ""}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="border border-console-border bg-console-surface">
          <div className="bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
            // Guest Registration Card
          </div>
          <div className="space-y-3.5 p-3.5">
            <FormField
              control={form.control}
              name="purposeOfVisit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purpose of Visit</FormLabel>
                  <FormControl>
                    <select
                      className={selectClassName}
                      {...field}
                      onChange={(event) =>
                        field.onChange(event.target.value as PurposeOfVisitValue)
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
                    <FormLabel>Purpose Detail</FormLabel>
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
                      onChange={(event) => field.onChange(event.target.checked)}
                    />
                    <span>
                      Saya konfirmasi data tamu sudah benar dan tamu sudah hadir
                      secara fisik.
                    </span>
                  </label>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="border border-console-border bg-console-surface">
          <div className="bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
            // Deposit (Optional)
          </div>
          <div className="space-y-3.5 p-3.5">
            {depositNote ? (
              <p className="text-[11px] text-slate-500">{depositNote}</p>
            ) : null}

            <FormField
              control={form.control}
              name="depositAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deposit Amount</FormLabel>
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
                      <FormLabel>Deposit Method</FormLabel>
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
                          <option value="">Select method</option>
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

                <FormField
                  control={form.control}
                  name="depositReference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Reference
                        {depositMethod === "TRANSFER" ? " / Required" : ""}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="BCA TRF 12345"
                          className={fieldClassName}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            ) : null}
          </div>
        </section>

        {actionError || form.formState.errors.root?.message ? (
          <p className="border border-red-500 bg-status-od-bg px-3 py-2 text-[12px] text-status-od-fg">
            {actionError ?? form.formState.errors.root?.message}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border border-console-border bg-console-surface p-3.5 sm:flex-row sm:justify-end">
          <Link
            href={cancelHref}
            className="inline-flex h-8 items-center justify-center border border-console-border bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={!form.formState.isValid || form.formState.isSubmitting}
            className="h-8 rounded-none border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
          >
            {form.formState.isSubmitting
              ? "Completing..."
              : "Complete Check-In"}
          </button>
        </div>
      </form>
    </Form>
  );
}
