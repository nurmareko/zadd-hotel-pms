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
          className="absolute left-0 top-[calc(100%+6px)] z-30 w-56 border border-console-border bg-console-ink p-2 text-console-accent shadow-[3px_3px_0_#00d4aa]"
          id={panelId}
          role="dialog"
        >
          <div className="mb-2 border-b border-console-accent/30 pb-1.5 text-[10px] font-bold uppercase tracking-[0.08em]">
            {isReserved ? "Meja Dipesan" : "Tidak Tersedia"}
          </div>

          {isReserved ? (
            <div className="grid gap-2">
              {noteText ? (
                <p className="border border-console-accent/30 bg-slate-950 px-2.5 py-2 text-[11px] leading-4 text-slate-200">
                  {noteText}
                </p>
              ) : null}
              <Link
                className="inline-flex h-8 items-center border border-console-accent bg-console-accent px-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:bg-white focus:outline-none focus:ring-2 focus:ring-white"
                href={`/app/fb/orders/new?tableId=${tableId}`}
                ref={seatGuestsRef}
              >
                Dudukkan Tamu
              </Link>
              <button
                className="inline-flex h-8 items-center border border-console-accent/60 bg-console-ink px-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:border-console-accent hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-50"
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
                <p className="border border-console-accent/30 bg-slate-950 px-2.5 py-2 text-[11px] leading-4 text-slate-200">
                  {noteText}
                </p>
              ) : null}
              <button
                className="inline-flex h-8 items-center border border-console-accent bg-console-accent px-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:bg-white focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-50"
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
