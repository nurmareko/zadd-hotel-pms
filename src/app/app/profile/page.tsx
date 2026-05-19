import { format } from "date-fns";
import { id as indonesianLocale } from "date-fns/locale";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AccountCard } from "./account-card";
import { PasswordForm } from "./password-form";

function dateLabel(date: Date) {
  return format(date, "d MMMM yyyy", { locale: indonesianLocale });
}

function dateTimeLabel(date: Date) {
  return format(date, "d MMMM yyyy HH:mm", { locale: indonesianLocale });
}

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = Number(session.user.id);

  if (!Number.isInteger(userId)) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      username: true,
      email: true,
      fullName: true,
      createdAt: true,
      roles: {
        select: {
          role: {
            select: {
              code: true,
              name: true,
            },
          },
        },
        take: 1,
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  const sessionStartedAt = session.user.sessionStartedAt
    ? new Date(session.user.sessionStartedAt)
    : new Date();
  const role = user.roles[0]?.role;

  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mx-auto max-w-[600px]">
        <div className="mb-4">
          <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
            <span className="text-console-accent">▸ </span>
            Profil
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            Kelola informasi akun Anda
          </p>
        </div>

        <div className="space-y-3">
          <AccountCard
            fullName={user.fullName}
            username={user.username}
            email={user.email}
            roleCode={role?.code ?? null}
            roleName={role?.name ?? null}
            createdAtLabel={dateLabel(user.createdAt)}
            lastLoginLabel={dateTimeLabel(sessionStartedAt)}
          />
          <PasswordForm />
        </div>
      </div>
    </main>
  );
}
