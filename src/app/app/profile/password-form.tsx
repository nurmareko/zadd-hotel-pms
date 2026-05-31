"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";

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
import { changePassword } from "./actions";
import {
  ChangePasswordSchema,
  type ChangePasswordInput,
} from "./schema";

const emptyValues: ChangePasswordInput = {
  currentPassword: "",
  newPassword: "",
  confirmNewPassword: "",
};

export function PasswordForm() {
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(
      ChangePasswordSchema,
    ) as Resolver<ChangePasswordInput>,
    defaultValues: emptyValues,
  });

  async function onSubmit(values: ChangePasswordInput) {
    const formData = new FormData();
    formData.set("currentPassword", values.currentPassword);
    formData.set("newPassword", values.newPassword);
    formData.set("confirmNewPassword", values.confirmNewPassword);

    const result = await changePassword(formData);

    if (result.ok) {
      form.reset(emptyValues);
      toast.success("Password berhasil diubah");
      return;
    }

    toast.error(result.error);
  }

  return (
    <section className="overflow-hidden border border-console-border bg-console-surface">
      <div className="bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
        {"// GANTI PASSWORD"}
      </div>
      <div className="px-3.5 py-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                    Password saat ini
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      className="rounded-none border-console-border bg-console-surface text-[13px] focus-visible:border-console-ink"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                    Password baru
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      className="rounded-none border-console-border bg-console-surface text-[13px] focus-visible:border-console-ink"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmNewPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                    Konfirmasi password baru
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      className="rounded-none border-console-border bg-console-surface text-[13px] focus-visible:border-console-ink"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <div className="flex justify-end border-t border-console-border pt-4">
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="h-8 rounded-none border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
              >
                {form.formState.isSubmitting
                  ? "Menyimpan..."
                  : "Simpan Password"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </section>
  );
}
