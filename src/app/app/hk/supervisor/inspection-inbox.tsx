import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMonthDayTimeID } from "@/lib/format";

export type InspectionInboxRow = {
  id: number;
  number: string;
  roomTypeName: string;
  cleanedByName: string | null;
  cleanedAt: Date | null;
  href: string;
  linenChanged: boolean;
  towelChanged: boolean;
};

export function InspectionInbox({ rooms }: { rooms: InspectionInboxRow[] }) {
  return (
    <Card className="mb-4 rounded-lg overflow-hidden p-0">
      <CardHeader className="border-b border-border rounded-none px-5 py-4">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-semibold">
            Menunggu Inspeksi
          </CardTitle>
          <Badge variant="secondary" className="rounded-full h-5 min-w-5 px-1.5 text-xs font-semibold">
            {rooms.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {rooms.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">
            Tidak ada kamar menunggu inspeksi.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {rooms.map((room) => (
              <li key={room.id}>
                <Link
                  href={room.href}
                  className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="shrink-0 text-base font-bold text-foreground">
                      {room.number}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {room.roomTypeName}
                    </span>
                    {room.linenChanged || room.towelChanged ? (
                      <span className="inline-flex gap-1 shrink-0">
                        {room.linenChanged ? (
                          <Badge variant="secondary" className="text-xs rounded-full py-0 h-5">
                            Linen
                          </Badge>
                        ) : null}
                        {room.towelChanged ? (
                          <Badge variant="secondary" className="text-xs rounded-full py-0 h-5">
                            Handuk
                          </Badge>
                        ) : null}
                      </span>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    {room.cleanedByName ? (
                      <>
                        <span className="text-foreground font-medium">{room.cleanedByName}</span>
                        {room.cleanedAt ? (
                          <span> · {formatMonthDayTimeID(room.cleanedAt)}</span>
                        ) : null}
                      </>
                    ) : (
                      <span>Housekeeper tidak diketahui</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
