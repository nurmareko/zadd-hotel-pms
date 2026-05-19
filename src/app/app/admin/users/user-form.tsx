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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createUser, updateUser } from "./actions";
import {
  roleCodes,
  UserCreateSchema,
  UserUpdateSchema,
  type RoleCode,
} from "./schema";

type UserFormDefaultValues = {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  role: RoleCode;
};

type UserFormInput = {
  id?: number;
  username: string;
  fullName: string;
  email?: string | null;
  password?: string;
  role: RoleCode;
};

type UserFormProps = {
  defaultValues?: UserFormDefaultValues;
  onCancel: () => void;
  onSaved: () => void;
};

const emptyValues: UserFormInput = {
  username: "",
  fullName: "",
  email: "",
  password: "",
  role: "FO",
};

const inputClassName =
  "h-8 rounded-none border-console-border bg-console-surface text-[12px] focus-visible:border-console-ink";

const labelClassName =
  "text-[10px] font-semibold uppercase tracking-[0.06em]";

const buttonClassName =
  "h-8 rounded-none border-console-border bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg";

const primaryButtonClassName =
  "h-8 rounded-none border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800 hover:text-console-accent";

function isRoleCode(value: unknown): value is RoleCode {
  return roleCodes.some((role) => role === value);
}

export function UserForm({
  defaultValues,
  onCancel,
  onSaved,
}: UserFormProps) {
  const isEditing = Boolean(defaultValues);
  const initialValues = defaultValues
    ? { ...defaultValues, email: defaultValues.email ?? "" }
    : emptyValues;
  const form = useForm<UserFormInput>({
    resolver: zodResolver(
      isEditing ? UserUpdateSchema : UserCreateSchema,
    ) as Resolver<UserFormInput>,
    defaultValues: initialValues,
  });

  async function onSubmit(values: UserFormInput) {
    const result = isEditing
      ? await updateUser({ ...values, id: defaultValues?.id })
      : await createUser(values);

    if (result.ok) {
      toast.success(isEditing ? "User updated" : "User created");
      form.reset(emptyValues);
      onSaved();
      return;
    }

    toast.error(result.error);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClassName}>Username</FormLabel>
                <FormControl>
                  <Input
                    placeholder="fo2"
                    readOnly={isEditing}
                    {...field}
                    className={`${inputClassName} ${isEditing ? "bg-console-bg" : ""}`}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClassName}>Role</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    if (isRoleCode(value)) {
                      field.onChange(value);
                    }
                  }}
                >
                  <FormControl>
                    <SelectTrigger className={`${inputClassName} w-full`}>
                      <SelectValue placeholder="Pilih role" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent align="start">
                    {roleCodes.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelClassName}>Nama Lengkap</FormLabel>
              <FormControl>
                <Input
                  placeholder="Front Office User"
                  {...field}
                  className={inputClassName}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelClassName}>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="fo2@example.com"
                  {...field}
                  value={field.value ?? ""}
                  className={inputClassName}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {!isEditing ? (
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClassName}>Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Minimum 6 characters"
                    {...field}
                    value={field.value ?? ""}
                    className={inputClassName}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t border-console-border pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className={buttonClassName}
            onClick={onCancel}
          >
            Batal
          </Button>
          <Button
            type="submit"
            className={primaryButtonClassName}
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting
              ? "Saving..."
              : isEditing
                ? "Simpan Perubahan"
                : "Buat Pengguna"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
