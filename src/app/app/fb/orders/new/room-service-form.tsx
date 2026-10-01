"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { BedDouble, CheckCircle2, Search, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  createRoomServiceOrder,
  lookupRoomForCharge,
  type ChargeLookupResult,
} from "../[orderId]/actions";

export type InHouseRoomItem = {
  reservationId?: number;
  roomNumber: string;
  guestName: string;
  status: string;
};

type RoomServiceFormProps = {
  inHouseRooms?: InHouseRoomItem[];
};

export function RoomServiceForm({ inHouseRooms = [] }: RoomServiceFormProps) {
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
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [roomNumber]);

  function handleSelectRoom(number: string) {
    setRoomNumber(number);
    setLookupResult(null);
  }

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
      {inHouseRooms.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Pilih Kamar In-House ({inHouseRooms.length})
            </span>
            <span className="text-[11px] text-slate-500">Klik untuk memilih langsung</span>
          </div>
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto pr-1">
            {inHouseRooms.map((room, index) => {
              const isSelected = roomNumber.trim() === room.roomNumber;
              return (
                <button
                  key={
                    room.reservationId
                      ? `in-house-room-${room.roomNumber}-${room.reservationId}`
                      : `in-house-room-${room.roomNumber}-${index}`
                  }
                  type="button"
                  onClick={() => handleSelectRoom(room.roomNumber)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-all ${
                    isSelected
                      ? "border border-blue-600 bg-blue-50 text-blue-900 shadow-xs ring-1 ring-blue-500"
                      : "border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-slate-50"
                  }`}
                >
                  <BedDouble className="h-3.5 w-3.5 text-blue-600" />
                  <span className="font-bold">{room.roomNumber}</span>
                  <span className="text-slate-400">·</span>
                  <span className="max-w-[130px] truncate text-slate-600">
                    {room.guestName}
                  </span>
                  <span
                    className={`ml-1 rounded px-1 py-0.2 text-[9px] font-semibold ${
                      room.status === "OC"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {room.status}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-800">
          ⚠️ Saat ini tidak ada kamar dengan tamu in-house (CHECKED_IN).
        </div>
      )}

      <div>
        <label
          className="mb-1.5 block text-sm font-semibold text-slate-700"
          htmlFor="room-number"
        >
          Nomor Kamar
        </label>
        <div className="relative">
          <Input
            className="h-10 rounded-md border-gray-300 bg-white pl-9 pr-8 text-sm text-slate-900 outline-none transition-colors focus-visible:border-blue-500 focus-visible:ring-blue-100"
            id="room-number"
            maxLength={10}
            onChange={(event) => {
              setRoomNumber(event.target.value);
              setLookupResult(null);
            }}
            placeholder="Ketik atau pilih nomor kamar (contoh: 101, 204)"
            value={roomNumber}
          />
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          {roomNumber ? (
            <button
              type="button"
              onClick={() => {
                setRoomNumber("");
                setLookupResult(null);
              }}
              className="absolute right-2.5 top-2.5 rounded p-0.5 text-xs text-slate-400 hover:text-slate-600"
              aria-label="Hapus nomor kamar"
            >
              ✕
            </button>
          ) : null}
        </div>
      </div>

      {isLookupPending ? (
        <div className="rounded-lg border border-gray-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
          Mencari tamu in-house...
        </div>
      ) : lookupResult?.ok ? (
        <div className="rounded-lg border border-status-oc-pip bg-status-oc-bg px-3.5 py-3 text-sm text-status-oc-fg">
          <div className="flex items-center gap-1.5 font-bold">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Tamu In-House Terverifikasi
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <div className="flex items-center gap-1 font-semibold text-slate-800">
              <User className="h-3.5 w-3.5 text-slate-500" />
              {lookupResult.guestName}
            </div>
            <div className="text-slate-600">
              Kamar: <span className="font-bold text-slate-900">{lookupResult.roomNumber}</span>
            </div>
            <div className="text-slate-600">
              Folio: <span className="font-mono font-bold text-slate-900">{lookupResult.folioNo}</span>
            </div>
          </div>
        </div>
      ) : lookupResult ? (
        <div className="rounded-lg border border-status-od-pip bg-status-od-bg px-3 py-2.5 text-sm font-medium text-status-od-fg">
          {lookupResult.error}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
          Pilih atau ketik nomor kamar in-house di atas untuk validasi otomatis.
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
          className="h-10 rounded-md border-gray-300 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus-visible:border-blue-500 focus-visible:ring-blue-100"
          id="guest-count"
          inputMode="numeric"
          min={1}
          onChange={(event) => setGuestCount(event.target.value)}
          type="number"
          value={guestCount}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 pt-4">
        <Button disabled={isSubmitPending || !lookupResult?.ok} type="submit">
          {isSubmitPending ? "Memproses..." : "Lanjutkan Buat Order"}
        </Button>
      </div>
    </form>
  );
}
