import { z } from "zod";

export const MenuItemCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(20, "Code must be 20 characters or fewer")
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Code may only contain letters, numbers, underscores, and hyphens",
    )
    .transform((value) => value.toUpperCase()),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or fewer"),
  category: z
    .string()
    .trim()
    .min(1, "Category is required")
    .max(50, "Category must be 50 characters or fewer"),
  price: z.coerce
    .number("Price is required")
    .int("Price must be a whole number")
    .positive("Price must be greater than 0"),
});

export const MenuItemUpdateSchema = MenuItemCreateSchema.extend({
  id: z.coerce.number().int().positive("Menu item is required"),
});

export const MenuItemIdSchema = z.object({
  id: z.coerce.number().int().positive("Menu item is required"),
});

export type MenuItemFormInput = z.input<typeof MenuItemCreateSchema>;
export type MenuItemFormValues = z.output<typeof MenuItemCreateSchema>;
