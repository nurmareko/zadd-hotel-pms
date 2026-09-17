"use client";

import { Bell, Check, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { HousekeepingNotificationItem } from "@/lib/housekeeping-notifications";

const statusLabels = {
  ASSIGNED: "Ditugaskan",
  IN_PROGRESS: "Sedang dikerjakan",
  COMPLETED: "Selesai",
} as const;

const statusClasses = {
  ASSIGNED: "bg-amber-100 text-amber-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
} as const;

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function HousekeepingNotificationBell({ touchTargets = false }: { touchTargets?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<HousekeepingNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  async function loadNotifications() {
    setLoading(true);

    try {
      const response = await fetch("/api/hk/notifications", { cache: "no-store" });

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as {
        items: HousekeepingNotificationItem[];
        unreadCount: number;
      };
      setItems(data.items);
      setUnreadCount(data.unreadCount);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadNotifications();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    function refreshNotifications() {
      void loadNotifications();
    }

    window.addEventListener(
      "housekeeping-notifications-refresh",
      refreshNotifications,
    );

    return () => {
      window.removeEventListener(
        "housekeeping-notifications-refresh",
        refreshNotifications,
      );
    };
  }, []);

  async function openNotification(item: HousekeepingNotificationItem) {
    if (!item.readAt) {
      const response = await fetch("/api/hk/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: item.id }),
      });

      if (response.ok) {
        setItems((current) =>
          current.map((notification) =>
            notification.id === item.id
              ? { ...notification, readAt: new Date().toISOString() }
              : notification,
          ),
        );
        setUnreadCount((count) => Math.max(0, count - 1));
      }
    }

    setOpen(false);
    router.push(item.href);
  }

  return (
    <div className={`fixed top-2.5 z-30 desktop:right-6 desktop:top-4 ${touchTargets ? "right-20" : "right-14"}`}>
      <button
        type="button"
        aria-label="Notifikasi housekeeping"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
          if (!open) {
            void loadNotifications();
          }
        }}
        className={`relative flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 ${touchTargets ? "h-12 w-12" : "h-10 w-10"}`}
      >
        <Bell className="size-[18px]" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <section className={`w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl ${touchTargets ? "fixed right-4 top-16 desktop:right-6 desktop:top-20" : "absolute right-0 top-12"}`}>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Notifikasi tugas</h2>
              <p className="mt-0.5 text-xs text-slate-500">Housekeeping</p>
            </div>
            <Bell className="size-4 text-slate-400" aria-hidden="true" />
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-slate-500">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Memuat notifikasi...
            </div>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              Belum ada notifikasi tugas.
            </p>
          ) : (
            <div className="max-h-[min(28rem,calc(100vh-7rem))] overflow-y-auto">
              {items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => void openNotification(item)}
                  className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-slate-50 ${item.readAt ? "bg-white" : "bg-amber-50/60"}`}
                >
                  <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${item.readAt ? "bg-slate-100 text-slate-400" : "bg-amber-100 text-amber-700"}`}>
                    {item.readAt ? (
                      <Check className="size-3.5" aria-hidden="true" />
                    ) : (
                      <Bell className="size-3.5" aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        Kamar {item.roomNumber}
                      </span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClasses[item.status]}`}>
                        {statusLabels[item.status]}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs text-slate-600">
                      {item.taskType} · {item.assignmentInfo}
                    </span>
                    <span className="mt-1 block text-[11px] text-slate-400">
                      {formatNotificationDate(item.createdAt)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
