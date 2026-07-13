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

import { Button, buttonVariants } from "@/components/ui/button";

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
          className="absolute left-0 top-[calc(100%+8px)] z-30 w-60 rounded-lg border border-gray-200 bg-white p-3 text-slate-900 shadow-lg"
          id={panelId}
          role="dialog"
        >
          <div className="mb-3 border-b border-gray-100 pb-2 text-sm font-semibold text-slate-900">
            {isReserved ? "Meja Dipesan" : "Tidak Tersedia"}
          </div>

          {isReserved ? (
            <div className="grid gap-2">
              {noteText ? (
                <p className="rounded-lg border border-gray-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                  {noteText}
                </p>
              ) : null}
              <Link
                className={buttonVariants()}
                href={`/app/fb/orders/new?tableId=${tableId}`}
                ref={seatGuestsRef}
              >
                Dudukkan Tamu
              </Link>
              <Button
                disabled={isPending}
                onClick={handleSetAvailable}
                type="button"
                variant="outline"
              >
                {isPending ? "Memproses..." : "Lepas Reservasi"}
              </Button>
            </div>
          ) : (
            <div className="grid gap-2">
              {noteText ? (
                <p className="rounded-lg border border-gray-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                  {noteText}
                </p>
              ) : null}
              <Button
                disabled={isPending}
                onClick={handleSetAvailable}
                ref={setAvailableRef}
                type="button"
                variant="danger"
              >
                {isPending ? "Memproses..." : "Jadikan Tersedia"}
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
