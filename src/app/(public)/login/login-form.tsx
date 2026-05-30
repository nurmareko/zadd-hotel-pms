"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Username wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
});

const demoAccounts = [
  { username: "admin", password: "admin123", role: "Administrator" },
  { username: "fo1", password: "fo123", role: "Front Office" },
  { username: "hk1", password: "hk123", role: "Housekeeping" },
  { username: "fb1", password: "fb123", role: "Food & Beverage" },
  { username: "acc1", password: "acc123", role: "Accounting" },
];

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });
  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: LoginFormValues) {
    setError(null);

    const result = await signIn("credentials", {
      username: values.username,
      password: values.password,
      redirect: false,
      redirectTo: "/",
    });

    if (!result?.ok || result.error || !result.url) {
      setError("Username atau password salah");
      form.setFocus("password");
      return;
    }

    router.push(result.url ?? "/");
    router.refresh();
  }

  function fillDemoAccount(account: (typeof demoAccounts)[number]) {
    setError(null);
    form.setValue("username", account.username, { shouldValidate: true });
    form.setValue("password", account.password, { shouldValidate: true });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-5"
        noValidate
      >
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-700">
                  Username
                </FormLabel>
                <FormControl>
                  <Input
                    autoFocus
                    autoComplete="username"
                    disabled={isSubmitting}
                    placeholder="username"
                    className="h-10 rounded-none border-[#9ca3af] bg-white px-3 text-[13px] shadow-none placeholder:text-slate-400 focus-visible:border-console-accent focus-visible:ring-3 focus-visible:ring-console-accent/15 disabled:bg-slate-100"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-[11px]" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-700">
                  Password
                </FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    disabled={isSubmitting}
                    placeholder="password"
                    className="h-10 rounded-none border-[#9ca3af] bg-white px-3 text-[13px] shadow-none placeholder:text-slate-400 focus-visible:border-console-accent focus-visible:ring-3 focus-visible:ring-console-accent/15 disabled:bg-slate-100"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-[11px]" />
              </FormItem>
            )}
          />
        </div>

        {error ? (
          <div
            role="alert"
            className="border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-600"
          >
            {error}
          </div>
        ) : null}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-10 w-full rounded-none border-console-ink bg-console-ink text-[11px] font-semibold uppercase tracking-[0.08em] text-console-accent hover:bg-slate-800 hover:text-console-accent disabled:opacity-70"
        >
          {isSubmitting ? (
            <>
              <span
                className="size-3 animate-spin border border-console-accent border-t-transparent"
                aria-hidden="true"
              />
              Memproses
            </>
          ) : (
            "MASUK"
          )}
        </Button>

        <div className="border-t border-console-border-soft pt-4">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-700">
              Akun Demo
            </p>
            <p className="text-[10px] uppercase tracking-[0.06em] text-slate-400">
              Klik untuk isi
            </p>
          </div>

          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {demoAccounts.map((account) => (
              <button
                key={account.username}
                type="button"
                onClick={() => fillDemoAccount(account)}
                disabled={isSubmitting}
                className="flex items-center justify-between gap-2 border border-console-border bg-console-surface px-2.5 py-2 text-left transition-colors hover:border-console-accent hover:bg-console-bg focus-visible:border-console-accent focus-visible:outline-none disabled:opacity-60"
              >
                <span className="truncate text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink">
                  {account.role}
                </span>
                <span className="shrink-0 text-[10px] tracking-[0.04em] text-slate-500">
                  {account.username}
                </span>
              </button>
            ))}
          </div>
        </div>
      </form>
    </Form>
  );
}
