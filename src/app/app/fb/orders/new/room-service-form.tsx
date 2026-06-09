"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";

import {
  createRoomServiceOrder,
  lookupRoomForCharge,
  type ChargeLookupResult,
} from "../[orderId]/actions";

export function RoomServiceForm() {
  const [roomNumber, setRoomNumber] = useState("");
  const [guestCount, setGuestCount] = useState("1");
  const [lookupResult, setLookupResult] = useState<ChargeLookupResult | null>(
    null,
  );
  const [isLookupPending, startLookupTransition] = useTransition();
  const [isSubmitPending, startSubmitTransition] = useTransition();

  useEffect(() => {
    const normalizedRoom = roomNumber.trim();

    if (!normalizedRoom) {
      return;
    }

    const timeout = window.setTimeout(() => {
      startLookupTransition(async () => {
        const result = await lookupRoomForCharge({
          roomNumber: normalizedRoom,
        });
        setLookupResult(result);
      });
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [roomNumber]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!lookupResult?.ok) {
      const message = lookupResult?.error ?? "Validasi kamar terlebih dahulu";
      toast.error(message);
      return;
    }

    const parsedGuestCount = Number(guestCount);

    if (!Number.isInteger(parsedGuestCount) || parsedGuestCount < 1) {
      toast.error("Jumlah tamu minimal 1");
      return;
    }

    startSubmitTransition(async () => {
      const result = await createRoomServiceOrder({
        roomNumber: lookupResult.roomNumber,
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
          htmlFor="room-number"
        >
          Nomor Kamar
        </label>
        <Input
          className="h-8 rounded-none border-console-border bg-white text-[12px] text-console-ink outline-none focus:border-console-ink"
          id="room-number"
          maxLength={10}
          onChange={(event) => {
            setRoomNumber(event.target.value);
            setLookupResult(null);
          }}
          placeholder="204"
          value={roomNumber}
        />
      </div>

      {isLookupPending ? (
        <div className="border border-console-border bg-console-bg px-3 py-2 text-[12px] text-slate-500">
          Mencari tamu in-house...
        </div>
      ) : lookupResult?.ok ? (
        <div className="border border-status-oc-pip bg-status-oc-bg px-3 py-2 text-[12px] text-status-oc-fg">
          <div className="font-semibold">Tamu in-house ditemukan.</div>
          <div className="mt-1 leading-5">
            {lookupResult.guestName} · Kamar {lookupResult.roomNumber} ·{" "}
            <span className="num font-semibold">{lookupResult.folioNo}</span>
          </div>
        </div>
      ) : lookupResult ? (
        <div className="border border-status-od-pip bg-status-od-bg px-3 py-2 text-[12px] font-medium text-status-od-fg">
          {lookupResult.error}
        </div>
      ) : (
        <div className="border border-dashed border-console-border bg-console-bg px-3 py-2 text-[12px] text-slate-500">
          Masukkan nomor kamar in-house untuk membuka order room service.
        </div>
      )}

      <div>
        <label
          className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-600"
          htmlFor="guest-count"
        >
          Jumlah Tamu
        </label>
        <Input
          className="h-8 rounded-none border-console-border bg-white text-[12px] text-console-ink outline-none focus:border-console-ink"
          id="guest-count"
          inputMode="numeric"
          min={1}
          onChange={(event) => setGuestCount(event.target.value)}
          type="number"
          value={guestCount}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-console-border pt-4">
        <button
          className="h-8 border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800 disabled:opacity-50"
          disabled={isSubmitPending || !lookupResult?.ok}
          type="submit"
        >
          {isSubmitPending ? "Membuat..." : "Continue"}
        </button>
      </div>
    </form>
  );
}
