import { z } from "zod";

export const MenuItemCreateSchema = z.object({
  code: z
    .string("Kode wajib diisi")
    .trim()
    .min(1, "Kode wajib diisi")
    .max(20, "Kode maksimal 20 karakter")
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Kode hanya boleh huruf, angka, garis bawah, dan tanda hubung",
    )
    .transform((value) => value.toUpperCase()),
  name: z
    .string("Nama wajib diisi")
    .trim()
    .min(1, "Nama wajib diisi")
    .max(100, "Nama maksimal 100 karakter"),
  category: z
    .string("Kategori wajib diisi")
    .trim()
    .min(1, "Kategori wajib diisi")
    .max(50, "Kategori maksimal 50 karakter"),
  price: z.coerce
    .number("Harga wajib diisi")
    .int("Harga harus bilangan bulat")
    .positive("Harga harus lebih dari 0"),
});

export const MenuItemUpdateSchema = MenuItemCreateSchema.extend({
  id: z.coerce.number("Menu wajib dipilih").int("ID menu harus bilangan bulat").positive("Menu wajib dipilih"),
});

export const MenuItemIdSchema = z.object({
  id: z.coerce.number("Menu wajib dipilih").int("ID menu harus bilangan bulat").positive("Menu wajib dipilih"),
});

export type MenuItemFormInput = z.input<typeof MenuItemCreateSchema>;
export type MenuItemFormValues = z.output<typeof MenuItemCreateSchema>;
