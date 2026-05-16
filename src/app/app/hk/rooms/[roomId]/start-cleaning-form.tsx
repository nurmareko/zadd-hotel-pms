"use client";

import { Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { startCleaning } from "./actions";

export function StartCleaningForm({ roomId }: { roomId: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await startCleaning(formData);

      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }

      toast.success("Pembersihan dimulai");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="p-3.5">
      <input type="hidden" name="roomId" value={roomId} />
      <Button
        type="submit"
        disabled={isPending}
        className="h-11 w-full rounded-none border-console-ink bg-console-ink text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
      >
        <Play className="h-4 w-4" aria-hidden="true" />
        {isPending ? "Memulai..." : "Mulai Pembersihan"}
      </Button>
      {error ? (
        <p className="mt-3 border border-red-500 bg-status-od-bg px-3 py-2 text-[12px] text-status-od-fg">
          {error}
        </p>
      ) : null}
    </form>
  );
}
