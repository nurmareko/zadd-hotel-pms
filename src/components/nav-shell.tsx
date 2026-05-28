"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  BedDouble,
  Calculator,
  CalendarDays,
  ClipboardList,
  ConciergeBell,
  FileText,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings,
  Tag,
  Table2,
  User,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

import type { AppRole } from "@/auth";
import { getCurrentNavBadges } from "@/app/app/nav-badge-actions";
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

type MobileNavLink = NavLink & { activeHref?: string };

type NavShellProps = {
  children: ReactNode;
  initialNavBadges: NavBadgeMap;
  userRole: AppRole;
  userFullName: string;
};

const roleModuleNames: Record<AppRole, string> = {
  FO: "FRONT OFFICE",
  HK: "HOUSEKEEPING",
  FB: "FOOD & BEVERAGE",
  ACC: "ACCOUNTING",
  ADMIN: "ADMINISTRATOR",
};

const navGroupsByRole: Record<AppRole, NavGroup[]> = {
  FO: [
    {
      label: "Front Office",
      links: [
        {
          label: "Dashboard",
          href: "/app/fo",
          icon: LayoutDashboard,
          activeMatch: "startsWith",
          activePaths: [
            { href: "/app/fo/check-in", match: "startsWith" },
            { href: "/app/fo/check-out", match: "startsWith" },
            { href: "/app/fo/folios", match: "startsWith" },
          ],
        },
        {
          label: "Tape Chart",
          href: "/app/fo/tape-chart",
          icon: CalendarDays,
          activeMatch: "exact",
        },
        {
          label: "Reservations",
          href: "/app/fo/reservations",
          icon: ClipboardList,
          activeMatch: "startsWith",
        },
      ],
    },
  ],
  HK: [
    {
      label: "Housekeeping",
      links: [
        {
          label: "Rooms",
          href: "/app/hk",
          icon: BedDouble,
          activeMatch: "startsWith",
        },
      ],
    },
  ],
  FB: [
    {
      label: "Food & Beverage",
      links: [
        {
          label: "Tables",
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
        { label: "Users", href: "/app/admin/users", icon: Users },
        { label: "Rooms", href: "/app/admin/rooms", icon: BedDouble },
        { label: "Articles", href: "/app/admin/articles", icon: Tag },
        { label: "Tables", href: "/app/admin/tables", icon: Table2 },
        { label: "Menu", href: "/app/admin/menu", icon: UtensilsCrossed },
        { label: "Settings", href: "/app/admin/settings", icon: Settings },
      ],
    },
  ],
};

const accountGroup: NavGroup = {
  label: "Account",
  links: [
    {
      label: "Profile",
      href: "/app/profile",
      icon: User,
      activeMatch: "startsWith",
    },
  ],
};

const mobileModuleLinks: Record<AppRole, MobileNavLink> = {
  FO: { label: "FO", href: "/app/fo", icon: ConciergeBell },
  HK: { label: "HK", href: "/app/hk", icon: BedDouble },
  FB: { label: "FB", href: "/app/fb", icon: UtensilsCrossed },
  ACC: { label: "ACC", href: "/app/acc", icon: Calculator },
  ADMIN: {
    label: "Admin",
    href: "/app/admin/users",
    activeHref: "/app/admin",
    icon: Settings,
  },
};

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

function NavBadgePill({ badge }: { badge: NavBadge }) {
  return (
    <span
      aria-label={badge.label}
      className={[
        "ml-auto flex h-4 shrink-0 items-center border px-1 text-[9px] font-semibold uppercase leading-none tracking-[0.06em] tabular-nums",
        badge.tone === "pending"
          ? "border-amber-500/50 bg-amber-500/10 text-amber-500"
          : "border-console-accent/45 bg-console-accent/10 text-console-accent",
      ].join(" ")}
    >
      {badge.value}
    </span>
  );
}

export function NavShell({
  children,
  initialNavBadges,
  userRole,
  userFullName,
}: NavShellProps) {
  const pathname = usePathname();
  const [navBadges, setNavBadges] = useState(initialNavBadges);
  const lastPathnameRef = useRef(pathname);
  const [, startTransition] = useTransition();
  const navGroups = [...navGroupsByRole[userRole], accountGroup];
  const activeSidebarHref = getActiveSidebarHref(pathname, navGroups);
  const mobileLinks: MobileNavLink[] = [
    mobileModuleLinks[userRole],
    { label: "Profile", href: "/app/profile", icon: User },
  ];

  useEffect(() => {
    if (lastPathnameRef.current === pathname) {
      return;
    }

    lastPathnameRef.current = pathname;
    let cancelled = false;

    startTransition(() => {
      void getCurrentNavBadges().then((badges) => {
        if (!cancelled) {
          setNavBadges(badges);
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [pathname, startTransition]);

  return (
    <div className="min-h-screen flex-1 bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-[240px] flex-col border-r border-border bg-sidebar px-4 py-5 md:flex">
        {/* Brand header */}
        <div
          className="mb-5 flex items-center gap-2.5 pb-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div
            className="flex shrink-0 items-center justify-center text-console-accent"
            style={{
              width: 28,
              height: 28,
              border: "1px solid #00d4aa",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            Z
          </div>
          <div>
            <div
              className="text-white"
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              ZADD PMS
            </div>
            <div
              className="text-slate-400"
              style={{
                fontSize: 9,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {roleModuleNames[userRole]}
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-6">
          {navGroups.map((group) => (
            <section key={group.label}>
              <h2 className="mb-2 px-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#4b5563]">
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
                        "flex items-center gap-2 px-3 py-2 text-[12px] font-medium uppercase tracking-[0.04em] transition-colors",
                        isActive
                          ? "bg-white/[0.03] text-console-accent shadow-[inset_2px_0_0_#00d4aa]"
                          : "text-sidebar-foreground hover:text-console-accent hover:shadow-[inset_2px_0_0_#00d4aa]",
                      ].join(" ")}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Icon size={14} aria-hidden="true" />
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

        <div
          className="pt-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="truncate px-3 text-sm font-medium text-white">
            {userFullName}
          </p>
          <p className="mt-1 px-3 text-xs font-medium text-sidebar-foreground">
            {userRole}
          </p>
          <Button
            type="button"
            variant="ghost"
            className="mt-3 w-full justify-start gap-2 text-[12px] uppercase tracking-[0.04em] text-sidebar-foreground hover:bg-transparent hover:text-console-accent"
            onClick={() => void signOut({ redirectTo: "/login" })}
          >
            <LogOut size={14} aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-4 py-3 md:hidden">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{userFullName}</p>
          <p className="text-xs font-medium text-muted-foreground">
            {userRole}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Sign out"
          onClick={() => void signOut({ redirectTo: "/login" })}
        >
          <LogOut aria-hidden="true" />
        </Button>
      </div>

      <div className="min-h-screen pb-20 md:ml-[240px] md:pb-0">
        {children}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-2 border-t border-border bg-background md:hidden">
        {mobileLinks.map((link) => {
          const Icon = link.icon;
          const isActive = isActivePath(
            pathname,
            link.activeHref ?? link.href,
            "startsWith",
          );

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={[
                "flex min-h-16 flex-col items-center justify-center gap-1 px-2 text-xs font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              ].join(" ")}
            >
              <Icon className="size-5" aria-hidden="true" />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
