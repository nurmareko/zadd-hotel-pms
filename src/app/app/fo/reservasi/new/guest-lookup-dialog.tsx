"use client";

import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { guestIdTypeLabel } from "@/lib/guest-id-type";
import { searchGuestsAction } from "@/lib/guests/actions";
import type { GuestLookupResult } from "@/lib/guests/types";

type SearchState =
  | { status: "idle" | "loading" | "error" }
  | { status: "success"; guests: GuestLookupResult[] };

export function GuestLookupDialog({
  onSelect,
  disabled = false,
}: {
  onSelect: (guest: GuestLookupResult) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const [retry, setRetry] = useState(0);
  const requestVersion = useRef(0);
  const inputId = useId();

  useEffect(() => {
    if (!open || !query.trim()) return;

    const version = ++requestVersion.current;
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const guests = await searchGuestsAction(query.trim());
        if (active && version === requestVersion.current) {
          setState({ status: "success", guests });
        }
      } catch {
        if (active && version === requestVersion.current) {
          setState({ status: "error" });
        }
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, query, retry]);

  function changeOpen(nextOpen: boolean) {
    requestVersion.current += 1;
    setOpen(nextOpen);
    setQuery("");
    setState({ status: "idle" });
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" disabled={disabled} />}>
        <Search aria-hidden="true" className="size-4" />
        Cari Tamu Terdaftar
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Cari Tamu Terdaftar</DialogTitle>
          <DialogDescription>
            Pilih tamu untuk mengisi data reservasi. Perubahan data tamu akan disimpan ke profil terdaftar saat reservasi disimpan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label htmlFor={inputId} className="font-medium">Nama, nomor identitas, atau telepon</label>
          <Input
            id={inputId}
            type="search"
            autoComplete="off"
            placeholder="Ketik untuk mencari tamu"
            value={query}
            onChange={(event) => {
              requestVersion.current += 1;
              setQuery(event.target.value);
              setState({ status: event.target.value.trim() ? "loading" : "idle" });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
          />
        </div>
        <div aria-busy={state.status === "loading"} className="min-h-24">
          <p role="status" className="text-sm text-slate-600">
            {state.status === "idle" && "Masukkan kata pencarian untuk menemukan tamu terdaftar."}
            {state.status === "loading" && "Mencari tamu…"}
            {state.status === "success" && (state.guests.length
              ? `${state.guests.length} tamu ditemukan. Pilih tamu yang sesuai.`
              : "Tamu tidak ditemukan. Coba kata pencarian lain atau isi data tamu baru pada formulir.")}
          </p>
          {state.status === "error" && (
            <div className="space-y-3">
              <p role="alert" className="text-red-700">Pencarian tamu gagal. Silakan coba lagi.</p>
              <Button type="button" variant="outline" onClick={() => {
                requestVersion.current += 1;
                setState({ status: "loading" });
                setRetry((value) => value + 1);
              }}>Coba Lagi</Button>
            </div>
          )}
          {state.status === "success" && state.guests.length > 0 && (
            <ul className="mt-3 divide-y divide-slate-200">
              {state.guests.map((guest) => (
                <li key={guest.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col gap-1 rounded-md p-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    onClick={() => {
                      onSelect(guest);
                      changeOpen(false);
                    }}
                  >
                    <span className="font-semibold text-slate-900">{guest.fullName} <span className="font-normal text-slate-600">(#{guest.id})</span></span>
                    <span className="break-words text-sm text-slate-600">
                      {guestIdTypeLabel(guest.idType)}: {guest.idNumber || "Belum diisi"} · Telepon: {guest.phone || "Belum diisi"}
                    </span>
                    <span className="text-xs text-slate-600">
                      {guest.totalStays} reservasi · Kedatangan terakhir: {guest.lastStayDate
                        ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(guest.lastStayDate))
                        : "Belum ada reservasi"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Batal</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
