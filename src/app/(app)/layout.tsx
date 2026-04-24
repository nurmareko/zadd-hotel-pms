"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BedDouble,
  Calculator,
  ConciergeBell,
  Settings,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

type NavLink = {
  label: string;
  href: string;
};

type NavGroup = {
  label: string;
  links: NavLink[];
};

type MobileNavLink = NavLink & {
  activeHref?: string;
  icon: LucideIcon;
};

const navGroups: NavGroup[] = [
  {
    label: "FO",
    links: [
      { label: "Dashboard", href: "/app/fo" },
      { label: "Tape Chart", href: "/app/fo/tape-chart" },
      { label: "Reservations", href: "/app/fo/reservations" },
    ],
  },
  {
    label: "HK",
    links: [{ label: "Rooms", href: "/app/hk" }],
  },
  {
    label: "FB",
    links: [{ label: "Tables", href: "/app/fb" }],
  },
  {
    label: "ACC",
    links: [
      { label: "Dashboard", href: "/app/acc" },
      { label: "Night Audit", href: "/app/acc/night-audit" },
      { label: "Night Report", href: "/app/acc/night-report" },
    ],
  },
  {
    label: "Admin",
    links: [
      { label: "Users", href: "/app/admin/users" },
      { label: "Rooms", href: "/app/admin/rooms" },
      { label: "Articles", href: "/app/admin/articles" },
      { label: "Menu", href: "/app/admin/menu" },
      { label: "Settings", href: "/app/admin/settings" },
    ],
  },
  {
    label: "Account",
    links: [{ label: "Profile", href: "/app/profile" }],
  },
];

const mobileLinks: MobileNavLink[] = [
  { label: "FO", href: "/app/fo", icon: ConciergeBell },
  { label: "HK", href: "/app/hk", icon: BedDouble },
  { label: "FB", href: "/app/fb", icon: UtensilsCrossed },
  { label: "ACC", href: "/app/acc", icon: Calculator },
  { label: "Admin", href: "/app/admin/users", activeHref: "/app/admin", icon: Settings },
];

const sidebarLinksBySpecificity = [...navGroups.flatMap((group) => group.links)].sort(
  (a, b) => b.href.length - a.href.length,
);

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getActiveSidebarHref(pathname: string) {
  return sidebarLinksBySpecificity.find((link) => isActivePath(pathname, link.href))
    ?.href;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const activeSidebarHref = getActiveSidebarHref(pathname);

  return (
    <div className="min-h-screen flex-1 bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-[240px] flex-col border-r border-border bg-sidebar px-4 py-5 md:flex">
        <Link href="/app/fo" className="mb-6 block text-base font-semibold">
          Hotel PMS — dev scaffold
        </Link>
        <nav className="space-y-6">
          {navGroups.map((group) => (
            <section key={group.label}>
              <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </h2>
              <div className="space-y-1">
                {group.links.map((link) => {
                  const isActive = activeSidebarHref === link.href;

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={isActive ? "page" : undefined}
                      className={[
                        "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      ].join(" ")}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
      </aside>

      <div className="min-h-screen pb-20 md:ml-[240px] md:pb-0">{children}</div>

      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-border bg-background md:hidden">
        {mobileLinks.map((link) => {
          const Icon = link.icon;
          const isActive = isActivePath(pathname, link.activeHref ?? link.href);

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
