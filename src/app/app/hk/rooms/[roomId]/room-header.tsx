import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { RoomStatus } from "@prisma/client";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StatusPill } from "../../room-status-grid";

type RoomHeaderProps = {
  roomNumber: string;
  roomTypeName: string;
  status: RoomStatus;
};

export function RoomHeader({ roomNumber, roomTypeName, status }: RoomHeaderProps) {
  return (
    <header className="space-y-3">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link
          href="/app/hk"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 gap-1 text-muted-foreground hover:text-foreground"
          )}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Dashboard
        </Link>
        <span aria-hidden="true" className="text-border">/</span>
        <span className="font-medium text-foreground">Kamar {roomNumber}</span>
      </nav>

      {/* Room Identity Card */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-5 py-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Kamar {roomNumber}
          </h1>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {roomTypeName}
          </p>
        </div>
        <StatusPill status={status} />
      </div>
    </header>
  );
}
