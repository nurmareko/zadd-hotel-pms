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
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-5 py-4">
        <h2 className="text-[16px] font-semibold text-slate-900">
          Ganti Password
        </h2>
        <p className="mt-1 text-[13px] leading-5 text-slate-500">
          Perbarui password akun untuk menjaga akses tetap aman.
        </p>
      </div>
      <div className="px-5 py-5">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[13px] font-medium text-slate-700">
                    Password saat ini
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      className="h-10 rounded-md border-gray-300 bg-white text-[14px] shadow-sm focus-visible:border-slate-900 focus-visible:ring-4 focus-visible:ring-slate-900/10"
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
                  <FormLabel className="text-[13px] font-medium text-slate-700">
                    Password baru
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      className="h-10 rounded-md border-gray-300 bg-white text-[14px] shadow-sm focus-visible:border-slate-900 focus-visible:ring-4 focus-visible:ring-slate-900/10"
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
                  <FormLabel className="text-[13px] font-medium text-slate-700">
                    Konfirmasi password baru
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      className="h-10 rounded-md border-gray-300 bg-white text-[14px] shadow-sm focus-visible:border-slate-900 focus-visible:ring-4 focus-visible:ring-slate-900/10"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <div className="flex justify-end border-t border-gray-200 pt-4">
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="h-10 rounded-md border border-slate-900 bg-slate-900 px-4 text-[14px] font-semibold text-white shadow-sm hover:bg-slate-800"
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
