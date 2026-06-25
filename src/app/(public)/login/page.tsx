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
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 font-jakarta text-slate-900 sm:p-8">
      <div className="flex w-full max-w-[1000px] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm md:min-h-[600px] md:flex-row">
        <section className="hidden w-[45%] flex-col justify-between border-r border-gray-200 bg-slate-50 px-10 py-12 md:flex lg:px-12">
          <div>
            <BrandBlock />
          </div>

          <div className="mt-16 max-w-md">
            <h1 className="text-[32px] font-bold leading-tight text-slate-900">
              Hotel Management
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-slate-500">
              A modern operational workspace designed specifically for
              hospitality professionals. Empowering Front Office, Housekeeping,
              F&B, and Accounting teams.
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-gray-200 pt-6 text-[12px] font-medium text-slate-500">
            <span>Secure Access</span>
            <span>Role-Based Workspace</span>
          </div>
        </section>

        <section className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10 sm:py-16">
          <div className="w-full max-w-[380px]">
            <div className="mb-8 md:hidden">
              <BrandBlock compact />
            </div>

            <div className="mb-8 text-center">
              <h2 className="text-[28px] font-bold text-slate-900">
                Welcome back
              </h2>
              <p className="mt-2 text-[15px] text-slate-500">
                Sign in to your account to continue
              </p>
            </div>

            <LoginForm />
          </div>
        </section>
      </div>
    </main>
  );
}

function BrandBlock({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-slate-900 shadow-sm"
        style={{
          width: compact ? 36 : 40,
          height: compact ? 36 : 40,
          fontSize: compact ? 16 : 18,
          fontWeight: 600,
        }}
      >
        Z
      </div>
      <div>
        <div className="text-[13px] font-medium text-slate-500">ZADD</div>
        <div className="text-[16px] font-semibold leading-tight text-slate-900">
          Hotel Management
        </div>
      </div>
    </div>
  );
}
