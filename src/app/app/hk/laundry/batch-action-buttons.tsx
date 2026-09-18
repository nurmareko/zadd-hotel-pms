"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WashingMachine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { advanceLinenBatchStatus } from "@/lib/laundry/actions";

export function StartWashingButton({ id, batchCode }: { id: string; batchCode: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" disabled={pending} aria-busy={pending} onClick={() => {
        if (pending) return;
        const data = new FormData();
        data.set("batchId", id);
        setError(null);
        startTransition(async () => {
          try {
            const result = await advanceLinenBatchStatus(data);
            if ("error" in result) {
              setError(result.error);
              toast.error(result.error);
              return;
            }
            toast.success(`Batch ${batchCode} sedang dicuci.`);
            router.refresh();
          } catch {
            const message = "Status belum dapat diperbarui. Periksa status batch sebelum mencoba lagi.";
            setError(message);
            toast.error(message);
          }
        });
      }}>
        <WashingMachine className="size-4" aria-hidden="true" />{pending ? "Menyimpan..." : "Mulai Cuci"}<span className="sr-only"> {batchCode}</span>
      </Button>
      {error && <p role="alert" className="max-w-56 text-xs text-destructive">{error}</p>}
    </div>
  );
}
