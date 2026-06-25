import { Activity } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";

export type ActivityFeedRow = {
  id: string;
  timestamp: Date;
  timeLabel: string;
  description: string;
  href: string;
  linkLabel: string;
};

type ActivityFeedProps = {
  rows: ActivityFeedRow[];
};

export function ActivityFeed({ rows }: ActivityFeedProps) {
  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-white px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">
          Aktivitas Terakhir
        </h2>
      </div>

      <div className="divide-y divide-slate-100">
        {rows.length > 0 ? (
          rows.map((row) => (
            <div
              key={row.id}
              className="grid gap-2 px-5 py-3 text-sm hover:bg-slate-50 sm:grid-cols-[64px_minmax(0,1fr)_auto] sm:items-center"
            >
              <time className="text-xs font-medium text-slate-500">
                {row.timeLabel}
              </time>
              <div className="min-w-0 truncate text-slate-900">
                {row.description}
              </div>
              <Link
                href={row.href}
                className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
              >
                {row.linkLabel}
              </Link>
            </div>
          ))
        ) : (
          <EmptyState
            icon={Activity}
            title="Belum ada aktivitas hari ini"
            description="Aktivitas check-in, check-out, dan pembayaran akan muncul di sini."
            className="m-3.5"
          />
        )}
      </div>
    </section>
  );
}
