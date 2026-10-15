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
  .max(500, "Notes must not exceed 500 characters")
  .or(z.literal(""))
  .nullable()
  .optional()
  .transform((value) => (value ? value : null));

const formNumber = (schema: z.ZodNumber) =>
  z.preprocess(
    (value) =>
      (typeof value === "string" && value.trim() === "") ||
      value === null ||
      typeof value === "undefined"
        ? undefined
        : Number(value),
    schema,
  );

export const RestaurantTableCreateSchema = z.object({
  number: z
    .string()
    .trim()
    .min(1, "Table number is required")
    .max(10, "Table number must not exceed 10 characters")
    .regex(/^[A-Za-z0-9]+$/, "Table number must be alphanumeric"),
  capacity: formNumber(
    z
      .number({ error: "Capacity is required and must be a number" })
      .int("Capacity must be a whole number")
      .min(1, "Capacity must be at least 1"),
  ),
  location: z.enum(tableLocations, { error: "Select a valid location" }),
  status: z.enum(tableStatuses, { error: "Select a valid table status" }),
  notes: OptionalNotesSchema,
});

export const RestaurantTableUpdateSchema = RestaurantTableCreateSchema.extend({
  id: z.coerce.number().int().positive("Select a table"),
});

export const RestaurantTableIdSchema = z.object({
  id: z.coerce.number().int().positive("Select a table"),
});

export const RestaurantTablePositionSchema = RestaurantTableIdSchema.extend({
  posX: z.coerce.number().min(0, "Invalid X position"),
  posY: z.coerce.number().min(0, "Invalid Y position"),
});

export const RestaurantTableLocationSchema = z.object({
  location: z.enum(tableLocations, { error: "Select a valid location" }),
});

export type RestaurantTableFormInput = z.input<
  typeof RestaurantTableCreateSchema
>;
export type RestaurantTableFormValues = z.output<
  typeof RestaurantTableCreateSchema
>;
