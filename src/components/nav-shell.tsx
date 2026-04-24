"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  BedDouble,
  Calculator,
  ConciergeBell,
  LogOut,
  Settings,
  User,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

import type { AppRole } from "@/auth";
import { Button } from "@/components/ui/button";
import { getRoleHome } from "@/lib/role-routes";

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

type NavShellProps = {
  children: ReactNode;
  userRole: AppRole;
  userFullName: string;
};

const navGroupsByRole: Record<AppRole, NavGroup[]> = {
  FO: [
    {
      label: "Front Office",
      links: [
        { label: "Dashboard", href: "/app/fo" },
        { label: "Tape Chart", href: "/app/fo/tape-chart" },
        { label: "Reservations", href: "/app/fo/reservations" },
      ],
    },
  ],
  HK: [
    {
      label: "Housekeeping",
      links: [{ label: "Rooms", href: "/app/hk" }],
    },
  ],
  FB: [
    {
      label: "Food & Beverage",
      links: [{ label: "Tables", href: "/app/fb" }],
    },
  ],
  ACC: [
    {
      label: "Accounting",
      links: [
        { label: "Dashboard", href: "/app/acc" },
        { label: "Night Audit", href: "/app/acc/night-audit" },
        { label: "Night Report", href: "/app/acc/night-report" },
      ],
    },
  ],
  ADMIN: [
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
  ],
};

const accountGroup: NavGroup = {
  label: "Account",
  links: [{ label: "Profile", href: "/app/profile" }],
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

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getActiveSidebarHref(pathname: string, groups: NavGroup[]) {
  return [...groups.flatMap((group) => group.links)]
    .sort((a, b) => b.href.length - a.href.length)
    .find((link) => isActivePath(pathname, link.href))?.href;
}

export function NavShell({ children, userRole, userFullName }: NavShellProps) {
  const pathname = usePathname();
  const navGroups = [...navGroupsByRole[userRole], accountGroup];
  const activeSidebarHref = getActiveSidebarHref(pathname, navGroups);
  const mobileLinks = [
    mobileModuleLinks[userRole],
    { label: "Profile", href: "/app/profile", icon: User },
  ];

  return (
    <div className="min-h-screen flex-1 bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-[240px] flex-col border-r border-border bg-sidebar px-4 py-5 md:flex">
        <Link
          href={getRoleHome(userRole)}
          className="mb-6 block text-base font-semibold"
        >
          Hotel PMS
        </Link>

        <nav className="flex-1 space-y-6">
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

        <div className="border-t border-border pt-4">
          <p className="truncate px-3 text-sm font-medium">{userFullName}</p>
          <p className="mt-1 px-3 text-xs font-medium text-muted-foreground">
            {userRole}
          </p>
          <Button
            type="button"
            variant="ghost"
            className="mt-3 w-full justify-start"
            onClick={() => void signOut({ redirectTo: "/login" })}
          >
            <LogOut aria-hidden="true" />
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
