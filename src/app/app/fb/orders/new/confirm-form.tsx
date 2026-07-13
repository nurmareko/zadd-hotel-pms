"use client";

import { FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

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
    <form className="grid gap-4 p-5" onSubmit={handleSubmit}>
      <div>
        <label
          className="mb-1.5 block text-sm font-semibold text-slate-700"
          htmlFor="table-number"
        >
          Table
        </label>
        <input
          className="h-10 w-full rounded-md border border-gray-300 bg-slate-50 px-3 text-sm font-semibold text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          id="table-number"
          readOnly
          value={`${table.number} · kapasitas ${table.capacity}`}
        />
      </div>
      <div>
        <label
          className="mb-1.5 block text-sm font-semibold text-slate-700"
          htmlFor="guest-count"
        >
          Jumlah Tamu
        </label>
        <input
          className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          id="guest-count"
          inputMode="numeric"
          min={1}
          max={table.capacity}
          onChange={(event) => setGuestCount(event.target.value)}
          type="number"
          value={guestCount}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 pt-4">
        <Button disabled={isPending} type="submit">
          {isPending ? "Membuat..." : "Continue"}
        </Button>
      </div>
    </form>
  );
}
