"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  BedDouble,
  CalendarDays,
  ClipboardList,
  Archive,
  Gauge,
  FileText,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Moon,
  Settings,
  Tag,
  Table2,
  User,
  Users,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from "lucide-react";

import type { AppRole } from "@/auth";
import { Button } from "@/components/ui/button";
import type { NavBadge, NavBadgeMap } from "@/lib/nav-badge-types";

type ActiveMatch = "exact" | "startsWith";

type ActivePath = {
  href: string;
  match: ActiveMatch;
};

type NavLink = {
  label: string;
  href: string;
  icon: LucideIcon;
  activeMatch?: ActiveMatch;
  activePaths?: ActivePath[];
};

type NavGroup = {
  label: string;
  links: NavLink[];
};

type NavShellProps = {
  children: ReactNode;
  initialNavBadges: NavBadgeMap;
  userRole: AppRole;
  userIsSupervisor: boolean;
  userFullName: string;
};

const roleModuleNames: Record<AppRole, string> = {
  FO: "FRONT OFFICE",
  HK: "HOUSEKEEPING",
  FB: "FOOD & BEVERAGE",
  ACC: "ACCOUNTING",
  ADMIN: "ADMINISTRATOR",
};

const hkMemberNavGroup: NavGroup = {
  label: "Housekeeping",
  links: [
    {
      label: "Kamar Saya",
      href: "/app/hk/clean",
      icon: ClipboardList,
      activeMatch: "exact",
      activePaths: [{ href: "/app/hk/rooms", match: "startsWith" }],
    },
    {
      label: "Lost & Found",
      href: "/app/hk/lost-found",
      icon: Archive,
      activeMatch: "exact",
    },
  ],
};

const hkSupervisorNavGroup: NavGroup = {
  label: "Housekeeping",
  links: [
    {
      label: "Supervisor",
      href: "/app/hk/supervisor",
      icon: Gauge,
      activeMatch: "startsWith",
    },
    {
      label: "Kamar",
      href: "/app/hk/rooms",
      icon: BedDouble,
      activeMatch: "startsWith",
    },
    {
      label: "Lost & Found",
      href: "/app/hk/lost-found",
      icon: Archive,
      activeMatch: "exact",
    },
  ],
};

const navGroupsByRole: Record<AppRole, NavGroup[]> = {
  FO: [
    {
      label: "Front Office",
      links: [
        {
          label: "Kalender",
          href: "/app/fo/tape-chart",
          icon: CalendarDays,
          activeMatch: "exact",
        },
        {
          label: "Reservasi",
          href: "/app/fo/reservations",
          icon: ClipboardList,
          activeMatch: "startsWith",
        },
        {
          label: "Dashboard",
          href: "/app/fo/dashboard",
          icon: LayoutDashboard,
          activeMatch: "exact",
          activePaths: [
            { href: "/app/fo/check-in", match: "startsWith" },
            { href: "/app/fo/check-out", match: "startsWith" },
            { href: "/app/fo/folios", match: "startsWith" },
          ],
        },
        {
          label: "Lost & Found",
          href: "/app/hk/lost-found",
          icon: Archive,
          activeMatch: "exact",
        },
      ],
    },
  ],
  HK: [hkMemberNavGroup],
  FB: [
    {
      label: "Food & Beverage",
      links: [
        {
          label: "Meja",
          href: "/app/fb",
          icon: UtensilsCrossed,
          activeMatch: "startsWith",
        },
      ],
    },
  ],
  ACC: [
    {
      label: "Accounting",
      links: [
        {
          label: "Dashboard",
          href: "/app/acc",
          icon: LayoutDashboard,
          activeMatch: "exact",
        },
        {
          label: "Night Audit",
          href: "/app/acc/night-audit",
          icon: Moon,
          activeMatch: "startsWith",
        },
        {
          label: "Night Report",
          href: "/app/acc/night-report",
          icon: FileText,
          activeMatch: "exact",
          activePaths: [{ href: "/app/acc/reports", match: "startsWith" }],
        },
      ],
    },
  ],
  ADMIN: [
    {
      label: "Admin",
      links: [
        { label: "Pengguna", href: "/app/admin/users", icon: Users },
        { label: "Kamar", href: "/app/admin/rooms", icon: BedDouble },
        { label: "Artikel", href: "/app/admin/articles", icon: Tag },
        { label: "Meja", href: "/app/admin/tables", icon: Table2 },
        { label: "Menu", href: "/app/admin/menu", icon: UtensilsCrossed },
        { label: "Pengaturan", href: "/app/admin/settings", icon: Settings },
      ],
    },
    {
      label: "Housekeeping",
      links: [
        {
          label: "HK Supervisor",
          href: "/app/hk/supervisor",
          icon: Gauge,
          activeMatch: "startsWith",
        },
        {
          label: "Kamar",
          href: "/app/hk/rooms",
          icon: BedDouble,
          activeMatch: "startsWith",
        },
        {
          label: "Lost & Found",
          href: "/app/hk/lost-found",
          icon: Archive,
          activeMatch: "exact",
        },
      ],
    },
  ],
};

const accountGroup: NavGroup = {
  label: "Akun",
  links: [
    {
      label: "Profil",
      href: "/app/profile",
      icon: User,
      activeMatch: "startsWith",
    },
  ],
};

// Mobile bottom tab bar shows at most this many slots. When a role has more
// destinations than fit, the last slot becomes "Lainnya" (More), which opens a
// bottom sheet with the overflow routes.
const MAX_MOBILE_TABS = 5;

function isActivePath(pathname: string, href: string, match: ActiveMatch) {
  return match === "exact"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

function getActivePaths(link: NavLink): ActivePath[] {
  return [
    { href: link.href, match: link.activeMatch ?? "startsWith" },
    ...(link.activePaths ?? []),
  ];
}

function getActiveSidebarHref(pathname: string, groups: NavGroup[]) {
  return [...groups.flatMap((group) => group.links)]
    .flatMap((link) =>
      getActivePaths(link).map((activePath) => ({ link, activePath })),
    )
    .filter(({ activePath }) =>
      isActivePath(pathname, activePath.href, activePath.match),
    )
    .sort((a, b) => b.activePath.href.length - a.activePath.href.length)[0]
    ?.link.href;
}

function getNavGroups(userRole: AppRole, userIsSupervisor: boolean) {
  if (userRole === "HK" && userIsSupervisor) {
    return [hkSupervisorNavGroup, accountGroup];
  }

  return [...navGroupsByRole[userRole], accountGroup];
}

async function fetchCurrentNavBadges(): Promise<NavBadgeMap> {
  const response = await fetch("/api/nav-badges", { cache: "no-store" });

  if (!response.ok) {
    return {};
  }

  return response.json() as Promise<NavBadgeMap>;
}

function NavBadgePill({ badge }: { badge: NavBadge }) {
  return (
    <span
      aria-label={badge.label}
      className="ml-auto flex h-4 min-w-4 shrink-0 items-center justify-center border border-amber-500/50 bg-amber-500/10 px-1 text-[9px] font-semibold uppercase leading-none tracking-[0.06em] text-amber-500"
    >
      {badge.value}
    </span>
  );
}

// Badge anchored to a bottom-tab icon (icons are stacked above their label, so
// the sidebar's inline NavBadgePill does not fit here).
function TabBadgeDot({ badge }: { badge: NavBadge }) {
  return (
    <span
      aria-label={badge.label}
      className="absolute -right-2 -top-1 flex h-3.5 min-w-3.5 items-center justify-center border border-amber-500/50 bg-amber-500/15 px-0.5 text-[8px] font-semibold uppercase leading-none text-amber-500"
    >
      {badge.value}
    </span>
  );
}

export function NavShell({
  children,
  initialNavBadges,
  userRole,
  userIsSupervisor,
  userFullName,
}: NavShellProps) {
  const pathname = usePathname();
  const [navBadges, setNavBadges] = useState(initialNavBadges);
  const [moreOpen, setMoreOpen] = useState(false);
  const lastPathnameRef = useRef(pathname);
  const [, startTransition] = useTransition();
  const navGroups = getNavGroups(userRole, userIsSupervisor);
  const activeSidebarHref = getActiveSidebarHref(pathname, navGroups);

  // One mobile nav: a role-scoped bottom tab bar built from the same link set
  // (and the same longest-match active logic) as the desktop sidebar. Overflow
  // beyond MAX_MOBILE_TABS collapses into a "Lainnya" sheet.
  const mobileLinks = navGroups.flatMap((group) => group.links);
  const hasMoreTab = mobileLinks.length > MAX_MOBILE_TABS;
  const tabLinks = hasMoreTab
    ? mobileLinks.slice(0, MAX_MOBILE_TABS - 1)
    : mobileLinks;
  const moreLinks = hasMoreTab ? mobileLinks.slice(MAX_MOBILE_TABS - 1) : [];
  const moreBadge = moreLinks
    .map((link) => navBadges[link.href])
    .find((badge): badge is NavBadge => Boolean(badge));
  const isMoreActive = moreLinks.some(
    (link) => activeSidebarHref === link.href,
  );

  useEffect(() => {
    if (lastPathnameRef.current === pathname) {
      return;
    }

    lastPathnameRef.current = pathname;
    let cancelled = false;

    startTransition(() => {
      void fetchCurrentNavBadges()
        .then((badges) => {
          if (!cancelled) {
            setNavBadges(badges);
          }
        })
        .catch(() => {
          // Keep the last known badges if the refresh request fails.
        });
    });

    return () => {
      cancelled = true;
    };
  }, [pathname, startTransition]);

  return (
    <div className="min-h-screen flex-1 bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-[260px] flex-col border-r border-slate-200 bg-white px-4 py-5 desktop:flex">
        {/* Brand header */}
        <div className="mb-5 flex items-center gap-2.5 border-b border-slate-100 pb-4">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-900 text-[13px] font-bold text-white">
            Z
          </div>
          <div>
            <div className="text-[10px] font-bold tracking-wide text-slate-500 uppercase">
              ZADD
            </div>
            <div className="text-[13px] font-semibold leading-tight text-slate-900">
              Hotel Management
            </div>
            <div className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-slate-500">
              {roleModuleNames[userRole]}
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-6">
          {navGroups.map((group) => (
            <section key={group.label}>
              <h2 className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {group.label}
              </h2>
              <div className="space-y-0.5">
                {group.links.map((link) => {
                  const isActive = activeSidebarHref === link.href;
                  const Icon = link.icon;
                  const badge = navBadges[link.href];

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={isActive ? "page" : undefined}
                      className={[
                        "flex items-center gap-2 py-2 text-sm font-medium transition-colors border-l-2",
                        isActive
                          ? "bg-slate-100 text-slate-900 border-slate-900 pl-2.5"
                          : "text-slate-600 border-transparent pl-2.5 hover:bg-slate-50 hover:text-slate-900",
                      ].join(" ")}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Icon size={18} aria-hidden="true" />
                        <span className="truncate">{link.label}</span>
                      </span>
                      {badge ? <NavBadgePill badge={badge} /> : null}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>

        <div className="border-t border-slate-100 pt-4">
          <p className="truncate px-3 text-sm font-semibold text-slate-900">
            {userFullName}
          </p>
          <p className="mt-0.5 px-3 text-xs font-medium text-slate-500">
            {userRole}
          </p>
          <Button
            type="button"
            variant="ghost"
            className="mt-3 w-full justify-start gap-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 px-3 h-10 rounded-md"
            onClick={() => void signOut({ redirectTo: "/login" })}
          >
            <LogOut size={18} aria-hidden="true" />
            Keluar
          </Button>
        </div>
      </aside>

      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 desktop:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-900 text-[11px] font-bold text-white">
            Z
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{userFullName}</p>
            <p className="text-xs font-medium text-slate-500">
              {userRole}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Keluar"
          className="text-slate-600 hover:text-slate-900"
          onClick={() => void signOut({ redirectTo: "/login" })}
        >
          <LogOut className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="min-h-screen min-w-0 max-w-full pb-[calc(5rem+env(safe-area-inset-bottom))] desktop:ml-[260px] desktop:pb-0">
        {children}
      </div>

      {moreOpen ? (
        <div className="fixed inset-0 z-30 desktop:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Tutup menu"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 border-t border-slate-200 bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Lainnya
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Tutup menu"
                className="shrink-0 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                onClick={() => setMoreOpen(false)}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
            <div className="space-y-0.5">
              {moreLinks.map((link) => {
                const isActive = activeSidebarHref === link.href;
                const Icon = link.icon;
                const badge = navBadges[link.href];

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setMoreOpen(false)}
                    className={[
                      "flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors border-l-2",
                      isActive
                        ? "bg-slate-100 text-slate-900 border-slate-900 pl-2.5"
                        : "text-slate-600 border-transparent pl-2.5 hover:bg-slate-50 hover:text-slate-900",
                    ].join(" ")}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Icon size={18} aria-hidden="true" />
                      <span className="truncate">{link.label}</span>
                    </span>
                    {badge ? <NavBadgePill badge={badge} /> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <nav
        aria-label="Navigasi mobile"
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] desktop:hidden"
      >
        {tabLinks.map((link) => {
          const Icon = link.icon;
          const isActive = activeSidebarHref === link.href;
          const badge = navBadges[link.href];

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={[
                "flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium tracking-tight transition-colors",
                isActive
                  ? "text-slate-900 shadow-[inset_0_2px_0_#0f172a]"
                  : "text-slate-500 hover:text-slate-900",
              ].join(" ")}
            >
              <span className="relative">
                <Icon className="size-5" aria-hidden="true" />
                {badge ? <TabBadgeDot badge={badge} /> : null}
              </span>
              <span className="max-w-full truncate">{link.label}</span>
            </Link>
          );
        })}

        {hasMoreTab ? (
          <button
            type="button"
            aria-label="Menu lainnya"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(true)}
            className={[
              "flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium tracking-tight transition-colors",
              isMoreActive || moreOpen
                ? "text-slate-900 shadow-[inset_0_2px_0_#0f172a]"
                : "text-slate-500 hover:text-slate-900",
            ].join(" ")}
          >
            <span className="relative">
              <MoreHorizontal className="size-5" aria-hidden="true" />
              {moreBadge ? <TabBadgeDot badge={moreBadge} /> : null}
            </span>
            <span className="max-w-full truncate">Lainnya</span>
          </button>
        ) : null}
      </nav>
    </div>
  );
}
