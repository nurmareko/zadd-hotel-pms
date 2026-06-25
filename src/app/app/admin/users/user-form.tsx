"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useForm, type FieldPath, type Resolver } from "react-hook-form";
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
import { focusFirstFormError } from "@/lib/form-error-focus";
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

const inputClassName = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const labelClassName =
  "text-[10px] font-semibold uppercase tracking-[0.06em]";

const buttonClassName = "h-9 rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-accent hover:text-accent-foreground";

const primaryButtonClassName = "h-9 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-600/90";

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
  const [formElement, setFormElement] = useState<HTMLFormElement | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  function onInvalid() {
    focusFirstFormError(formElement);
  }

  async function onSubmit(values: UserFormInput) {
    const result = isEditing
      ? await updateUser({ ...values, id: defaultValues?.id })
      : await createUser(values);

    if (result.ok) {
      toast.success(isEditing ? "Pengguna diperbarui" : "Pengguna dibuat");
      form.reset(emptyValues);
      onSaved();
      return;
    }

    if (result.field) {
      form.setError(
        result.field as FieldPath<UserFormInput>,
        { type: "server", message: result.error },
        { shouldFocus: true },
      );
      focusFirstFormError(formElement);
    }

    toast.error(result.error);
  }

  return (
    <Form {...form}>
      <form
        ref={setFormElement}
        onSubmit={form.handleSubmit(onSubmit, onInvalid)}
        noValidate
        className="space-y-4"
      >
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
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Minimal 8 karakter"
                      {...field}
                      value={field.value ?? ""}
                      className={`${inputClassName} pr-9`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-8 w-8 rounded-none text-slate-500 hover:bg-slate-50 hover:text-foreground"
                      onClick={() => setShowPassword((isShown) => !isShown)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
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
              ? "Menyimpan..."
              : isEditing
                ? "Simpan Perubahan"
                : "Tambah Pengguna"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
