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
import { Textarea } from "@/components/ui/textarea";
import { updateHotelSettings } from "./actions";
import { HotelSettingsUpdateSchema } from "./schema";

type SettingsFormInput = {
  hotelName: string;
  address?: string | null;
  taxPercent: number | string;
  serviceChargePercent: number | string;
  nightAuditTime: string;
  currency: string;
};

type SettingsFormProps = {
  defaultValues: SettingsFormInput;
};

export function SettingsForm({ defaultValues }: SettingsFormProps) {
  const form = useForm<SettingsFormInput>({
    resolver: zodResolver(HotelSettingsUpdateSchema) as Resolver<SettingsFormInput>,
    defaultValues,
  });

  async function onSubmit(values: SettingsFormInput) {
    const result = await updateHotelSettings(values);

    if (result.ok) {
      toast.success("Settings updated");
      form.reset({
        ...values,
        address: values.address ?? "",
      });
      return;
    }

    toast.error(result.error);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="hotelName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hotel Name</FormLabel>
              <FormControl>
                <Input placeholder="Linggian Hotel" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Bandung, Indonesia"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="taxPercent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tax Percent</FormLabel>
                <FormControl>
                  <Input type="number" min={0} max={100} step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="serviceChargePercent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Service Charge Percent</FormLabel>
                <FormControl>
                  <Input type="number" min={0} max={100} step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="nightAuditTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Night Audit Time</FormLabel>
                <FormControl>
                  <Input placeholder="23:00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <FormControl>
                  <Input placeholder="IDR" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end border-t pt-4">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
