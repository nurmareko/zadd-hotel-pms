import { TableLocation, TableStatus } from "@prisma/client";
import { z } from "zod";

export const tableLocations = [
  TableLocation.INDOOR,
  TableLocation.OUTDOOR,
  TableLocation.PRIVATE,
] as const;

export const tableStatuses = [
  TableStatus.AVAILABLE,
  TableStatus.OCCUPIED,
  TableStatus.RESERVED,
  TableStatus.OUT_OF_SERVICE,
] as const;

const OptionalNotesSchema = z
  .string()
  .trim()
  .max(500, "Notes must be 500 characters or fewer")
  .or(z.literal(""))
  .nullable()
  .optional()
  .transform((value) => (value ? value : null));

export const RestaurantTableCreateSchema = z.object({
  number: z
    .string()
    .trim()
    .min(1, "Table number is required")
    .max(10, "Table number must be 10 characters or fewer"),
  capacity: z.coerce
    .number("Capacity is required")
    .int("Capacity must be a whole number")
    .min(1, "Capacity must be at least 1"),
  location: z.enum(tableLocations),
  status: z.enum(tableStatuses),
  notes: OptionalNotesSchema,
});

export const RestaurantTableUpdateSchema = RestaurantTableCreateSchema.extend({
  id: z.coerce.number().int().positive("Table is required"),
});

export const RestaurantTableIdSchema = z.object({
  id: z.coerce.number().int().positive("Table is required"),
});

export type TableLocationValue = (typeof tableLocations)[number];
export type TableStatusValue = (typeof tableStatuses)[number];
export type RestaurantTableFormInput = z.input<
  typeof RestaurantTableCreateSchema
>;
export type RestaurantTableFormValues = z.output<
  typeof RestaurantTableCreateSchema
>;
