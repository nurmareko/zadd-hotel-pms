"use client";

import { TableStatus } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

import {
  releaseTableReservation,
  setOutOfServiceTableAvailable,
} from "./actions";

type TableStatusPopoverProps = {
  children: ReactNode;
  className: string;
  notes: string | null;
  status: Extract<TableStatus, "RESERVED" | "OUT_OF_SERVICE">;
  tableId: number;
  tableNumber: string;
};

export function TableStatusPopover({
  children,
  className,
  notes,
  status,
  tableId,
  tableNumber,
}: TableStatusPopoverProps) {
  const router = useRouter();
  const panelId = useId();
  const seatGuestsRef = useRef<HTMLAnchorElement>(null);
  const setAvailableRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isReserved = status === TableStatus.RESERVED;
  const noteText = notes?.trim();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    (isReserved ? seatGuestsRef.current : setAvailableRef.current)?.focus();

    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen, isReserved]);

  function handleSetAvailable() {
    startTransition(async () => {
      const result = isReserved
        ? await releaseTableReservation({ tableId })
        : await setOutOfServiceTableAvailable({ tableId });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(isReserved ? "Reservasi dilepas" : "Meja tersedia");
      setIsOpen(false);
      router.refresh();
    });
  }

  return (
    <div
      className="relative h-full w-full"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setIsOpen(false);
        }
      }}
      ref={rootRef}
    >
      <button
        aria-controls={panelId}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={`Aksi meja ${tableNumber} ${isReserved ? "dipesan" : "tidak tersedia"}`}
        className={className}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        {children}
      </button>

      {isOpen ? (
        <div
          aria-label={`Aksi meja ${tableNumber}`}
          className="absolute left-0 top-[calc(100%+8px)] z-30 w-60 rounded-2xl border border-gray-200 bg-white p-3 text-slate-900 shadow-lg"
          id={panelId}
          role="dialog"
        >
          <div className="mb-3 border-b border-gray-100 pb-2 text-sm font-semibold text-slate-900">
            {isReserved ? "Meja Dipesan" : "Tidak Tersedia"}
          </div>

          {isReserved ? (
            <div className="grid gap-2">
              {noteText ? (
                <p className="rounded-xl border border-gray-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                  {noteText}
                </p>
              ) : null}
              <Link
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-900 bg-slate-900 px-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                href={`/app/fb/orders/new?tableId=${tableId}`}
                ref={seatGuestsRef}
              >
                Dudukkan Tamu
              </Link>
              <button
                className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
                disabled={isPending}
                onClick={handleSetAvailable}
                type="button"
              >
                {isPending ? "Memproses..." : "Lepas Reservasi"}
              </button>
            </div>
          ) : (
            <div className="grid gap-2">
              {noteText ? (
                <p className="rounded-xl border border-gray-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                  {noteText}
                </p>
              ) : null}
              <button
                className="inline-flex h-10 items-center justify-center rounded-xl border border-status-ooo-pip bg-status-ooo-pip px-3 text-sm font-semibold text-white transition-colors hover:bg-status-ooo-fg focus:outline-none focus:ring-2 focus:ring-status-ooo-bg disabled:opacity-50"
                disabled={isPending}
                onClick={handleSetAvailable}
                ref={setAvailableRef}
                type="button"
              >
                {isPending ? "Memproses..." : "Jadikan Tersedia"}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
