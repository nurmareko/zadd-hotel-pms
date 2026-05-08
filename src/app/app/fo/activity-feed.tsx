import Link from "next/link";

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
    <section className="border border-console-border bg-console-surface">
      <div className="border-b border-console-border bg-console-surface px-3.5 py-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-console-ink">
          Aktivitas Terakhir
        </h2>
      </div>

      <div className="divide-y divide-console-border-soft">
        {rows.length > 0 ? (
          rows.map((row) => (
            <div
              key={row.id}
              className="grid gap-2 px-3.5 py-2.5 text-[12px] odd:bg-console-surface even:bg-console-bg sm:grid-cols-[54px_minmax(0,1fr)_auto] sm:items-center"
            >
              <time className="num text-[11px] font-semibold text-slate-500">
                {row.timeLabel}
              </time>
              <div className="min-w-0 truncate text-console-ink">
                {row.description}
              </div>
              <Link
                href={row.href}
                className="text-[10px] font-semibold uppercase tracking-[0.04em] text-slate-600 hover:text-console-ink hover:underline"
              >
                [{row.linkLabel}]
              </Link>
            </div>
          ))
        ) : (
          <div className="px-3.5 py-8 text-center text-[12px] text-slate-500">
            Belum ada aktivitas hari ini.
          </div>
        )}
      </div>
    </section>
  );
}
