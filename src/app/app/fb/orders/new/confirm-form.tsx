"use client";

import { FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { createOrder } from "../[orderId]/actions";

type ConfirmFormProps = {
  table: {
    id: number;
    number: string;
    capacity: number;
  };
};

export function ConfirmForm({ table }: ConfirmFormProps) {
  const [guestCount, setGuestCount] = useState("1");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedGuestCount = Number(guestCount);

    if (!Number.isInteger(parsedGuestCount) || parsedGuestCount < 1) {
      toast.error("Jumlah tamu minimal 1");
      return;
    }

    if (parsedGuestCount > table.capacity) {
      toast.error(
        `Jumlah tamu tidak boleh melebihi kapasitas meja ${table.capacity}`,
      );
      return;
    }

    startTransition(async () => {
      const result = await createOrder({
        tableId: table.id,
        guestCount: parsedGuestCount,
      });

      if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
    <form className="grid gap-4 p-4" onSubmit={handleSubmit}>
      <div>
        <label
          className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-600"
          htmlFor="table-number"
        >
          Table #
        </label>
        <input
          className="h-8 w-full border border-console-border bg-slate-100 px-2.5 text-[12px] font-semibold text-console-ink outline-none"
          id="table-number"
          readOnly
          value={`${table.number} · kapasitas ${table.capacity}`}
        />
      </div>
      <div>
        <label
          className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-600"
          htmlFor="guest-count"
        >
          Jumlah Tamu
        </label>
        <input
          className="h-8 w-full border border-console-border bg-white px-2.5 text-[12px] text-console-ink outline-none focus:border-console-ink"
          id="guest-count"
          inputMode="numeric"
          min={1}
          max={table.capacity}
          onChange={(event) => setGuestCount(event.target.value)}
          type="number"
          value={guestCount}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-console-border pt-4">
        <button
          className="h-8 border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800 disabled:opacity-50"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Membuat..." : "Continue"}
        </button>
      </div>
    </form>
  );
}
