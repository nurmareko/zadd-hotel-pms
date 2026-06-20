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
  { username: "fo1", password: "fo123", role: "Front Office" },
  { username: "hksup", password: "hksup123", role: "HK Supervisor" },
  { username: "hk1", password: "hk123", role: "Housekeeping" },
  { username: "fb1", password: "fb123", role: "Food & Beverage" },
  { username: "acc1", password: "acc123", role: "Accounting" },
  { username: "admin", password: "admin123", role: "Administrator" },
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
                <FormLabel className="text-[13px] font-medium text-slate-700">
                  Username
                </FormLabel>
                <FormControl>
                  <Input
                    autoFocus
                    autoComplete="username"
                    disabled={isSubmitting}
                    placeholder="Enter your username"
                    className="h-11 rounded-xl border-slate-300 bg-white px-3 text-[14px] shadow-sm placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-4 focus-visible:ring-blue-500/10 disabled:bg-slate-50"
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
                <FormLabel className="text-[13px] font-medium text-slate-700">
                  Password
                </FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    disabled={isSubmitting}
                    placeholder="Enter your password"
                    className="h-11 rounded-xl border-slate-300 bg-white px-3 text-[14px] shadow-sm placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-4 focus-visible:ring-blue-500/10 disabled:bg-slate-50"
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
          className="h-11 w-full rounded-xl bg-blue-600 text-[14px] font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-70"
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
            "Sign In"
          )}
        </Button>

        <div className="border-t border-slate-200 pt-6 mt-4">
          <div className="mb-4 flex items-baseline justify-between">
            <p className="text-[13px] font-medium text-slate-700">
              Demo Accounts
            </p>
            <p className="text-[12px] text-slate-400">
              Click to autofill
            </p>
          </div>

          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {demoAccounts.map((account) => (
              <button
                key={account.username}
                type="button"
                onClick={() => fillDemoAccount(account)}
                disabled={isSubmitting}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-blue-500 hover:bg-slate-50 focus-visible:border-blue-500 focus-visible:outline-none disabled:opacity-60"
              >
                <span className="truncate text-[13px] font-medium text-slate-700">
                  {account.role}
                </span>
                <span className="shrink-0 text-[12px] text-slate-400">
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
