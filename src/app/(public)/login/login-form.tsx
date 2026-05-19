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

        <details className="group border-t border-console-border-soft pt-4">
          <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-700 marker:hidden">
            <span>Akun Demo</span>
            <span className="text-console-ink group-open:hidden">+</span>
            <span className="hidden text-console-ink group-open:inline">-</span>
          </summary>

          <div className="mt-3 overflow-x-auto border border-console-border">
            <table className="w-full border-collapse text-left text-[11px]">
              <thead className="bg-console-ink text-console-accent">
                <tr>
                  <th className="px-2.5 py-2 font-semibold uppercase tracking-[0.08em]">
                    User
                  </th>
                  <th className="px-2.5 py-2 font-semibold uppercase tracking-[0.08em]">
                    Pass
                  </th>
                  <th className="px-2.5 py-2 font-semibold uppercase tracking-[0.08em]">
                    Role
                  </th>
                </tr>
              </thead>
              <tbody>
                {demoAccounts.map((account) => (
                  <tr
                    key={account.username}
                    className="border-t border-console-border-soft even:bg-console-bg"
                  >
                    <td className="px-2.5 py-2 font-medium text-console-ink">
                      {account.username}
                    </td>
                    <td className="px-2.5 py-2 text-slate-600">
                      {account.password}
                    </td>
                    <td className="px-2.5 py-2 text-slate-600">
                      {account.role}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </form>
    </Form>
  );
}
