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
    <form className="grid gap-4 p-5" onSubmit={handleSubmit}>
      <div>
        <label
          className="mb-1.5 block text-sm font-semibold text-slate-700"
          htmlFor="room-number"
        >
          Nomor Kamar
        </label>
        <Input
          className="h-10 rounded-xl border-gray-300 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus-visible:border-blue-500 focus-visible:ring-blue-100"
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
        <div className="rounded-xl border border-gray-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
          Mencari tamu in-house...
        </div>
      ) : lookupResult?.ok ? (
        <div className="rounded-xl border border-status-oc-pip bg-status-oc-bg px-3 py-2.5 text-sm text-status-oc-fg">
          <div className="font-semibold">Tamu in-house ditemukan.</div>
          <div className="mt-1 leading-5">
            {lookupResult.guestName} · Kamar {lookupResult.roomNumber} ·{" "}
            <span className="num font-semibold">{lookupResult.folioNo}</span>
          </div>
        </div>
      ) : lookupResult ? (
        <div className="rounded-xl border border-status-od-pip bg-status-od-bg px-3 py-2.5 text-sm font-medium text-status-od-fg">
          {lookupResult.error}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
          Masukkan nomor kamar in-house untuk membuka order room service.
        </div>
      )}

      <div>
        <label
          className="mb-1.5 block text-sm font-semibold text-slate-700"
          htmlFor="guest-count"
        >
          Jumlah Tamu
        </label>
        <Input
          className="h-10 rounded-xl border-gray-300 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus-visible:border-blue-500 focus-visible:ring-blue-100"
          id="guest-count"
          inputMode="numeric"
          min={1}
          onChange={(event) => setGuestCount(event.target.value)}
          type="number"
          value={guestCount}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 pt-4">
        <button
          className="h-10 rounded-xl border border-slate-900 bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-50"
          disabled={isSubmitPending || !lookupResult?.ok}
          type="submit"
        >
          {isSubmitPending ? "Membuat..." : "Continue"}
        </button>
      </div>
    </form>
  );
}
