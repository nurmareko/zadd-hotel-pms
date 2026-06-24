import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { formatLongDateID, formatLongDateTimeID } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { AccountCard } from "./account-card";
import { PasswordForm } from "./password-form";

function dateLabel(date: Date) {
  return formatLongDateID(date);
}

function dateTimeLabel(date: Date) {
  return formatLongDateTimeID(date);
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
    <main className="min-h-screen bg-slate-50 px-4 py-5 font-jakarta text-slate-900 md:px-6 md:py-6">
      <div className="mx-auto max-w-[760px]">
        <div className="mb-5">
          <h1 className="text-[32px] font-bold leading-tight text-slate-900">
            Profil
          </h1>
          <p className="mt-2 text-[14px] leading-6 text-slate-500">
            Kelola informasi akun Anda
          </p>
        </div>

        <div className="space-y-4">
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
