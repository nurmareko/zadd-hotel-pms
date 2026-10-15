import { z } from "zod";

export const MenuItemCreateSchema = z.object({
  code: z
    .string("A code is required")
    .trim()
    .min(1, "A code is required")
    .max(20, "The code must not exceed 20 characters")
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "The code may contain only letters, numbers, underscores and hyphens",
    )
    .transform((value) => value.toUpperCase()),
  name: z
    .string("A name is required")
    .trim()
    .min(1, "A name is required")
    .max(100, "The name must not exceed 100 characters"),
  category: z
    .string("A category is required")
    .trim()
    .min(1, "A category is required")
    .max(50, "The category must not exceed 50 characters"),
  price: z.coerce
    .number("A price is required")
    .int("The price must be a whole number")
    .positive("The price must be greater than 0"),
});

export const MenuItemUpdateSchema = MenuItemCreateSchema.extend({
  id: z.coerce.number("Select a menu item").int("The menu item ID must be a whole number").positive("Select a menu item"),
});

export const MenuItemIdSchema = z.object({
  id: z.coerce.number("Select a menu item").int("The menu item ID must be a whole number").positive("Select a menu item"),
});

export type MenuItemFormInput = z.input<typeof MenuItemCreateSchema>;
export type MenuItemFormValues = z.output<typeof MenuItemCreateSchema>;
