import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getRoleHome } from "@/lib/role-routes";

import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect(getRoleHome(session.user.role));
  }

  return (
    <main className="min-h-screen bg-console-surface font-mono text-console-ink md:grid md:grid-cols-[45%_55%]">
      <section className="relative hidden overflow-hidden bg-console-ink px-10 py-9 text-white md:flex md:flex-col md:justify-between lg:px-14">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,212,170,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,170,0.22) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-x-0 top-0 h-px bg-console-accent"
          aria-hidden="true"
        />

        <div className="relative">
          <BrandBlock />
        </div>

        <div className="relative max-w-md">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-console-accent">
            {"// Operations Workspace"}
          </p>
          <h1 className="text-[28px] font-bold uppercase leading-tight tracking-[0.04em]">
            Property Management System
          </h1>
          <p className="mt-4 text-[12px] leading-6 text-slate-400">
            Operational workspace untuk Front Office, Housekeeping, F&amp;B,
            Accounting, dan Administrator.
          </p>
        </div>

        <div className="relative flex items-center justify-between border-t border-white/10 pt-5 text-[10px] uppercase tracking-[0.08em] text-slate-500">
          <span>Secure Access</span>
          <span>Role Based Workspace</span>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-console-bg px-5 py-8 sm:px-8 md:bg-console-surface">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 md:hidden">
            <BrandBlock compact />
          </div>

          <div className="border border-console-border bg-console-surface">
            <div className="border-b border-console-border bg-console-ink px-5 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
                {"// Login"}
              </p>
            </div>
            <div className="px-5 py-6 sm:px-7 sm:py-7">
              <div className="mb-6">
                <h2 className="text-[20px] font-bold uppercase tracking-[0.02em]">
                  Masuk ke Akun Anda
                </h2>
                <p className="mt-2 text-[12px] leading-5 text-slate-500">
                  Gunakan username dan password yang terdaftar.
                </p>
              </div>

              <LoginForm />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function BrandBlock({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex shrink-0 items-center justify-center border border-console-accent text-console-accent"
        style={{
          width: compact ? 32 : 36,
          height: compact ? 32 : 36,
          fontSize: compact ? 13 : 15,
          fontWeight: 700,
        }}
      >
        Z
      </div>
      <div>
        <div
          className={[
            "text-[12px] font-bold uppercase tracking-[0.08em]",
            compact ? "text-console-ink" : "text-white",
          ].join(" ")}
        >
          ZADD PMS
        </div>
        <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          Property Management System
        </div>
      </div>
    </div>
  );
}
