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
  .max(500, "Catatan maksimal 500 karakter")
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
    .min(1, "Nomor meja wajib diisi")
    .max(10, "Nomor meja maksimal 10 karakter")
    .regex(/^[A-Za-z0-9]+$/, "Nomor meja harus alfanumerik"),
  capacity: formNumber(
    z
      .number({ error: "Kapasitas wajib diisi dan harus berupa angka" })
      .int("Kapasitas harus bilangan bulat")
      .min(1, "Kapasitas minimal 1"),
  ),
  location: z.enum(tableLocations, { error: "Pilih lokasi yang valid" }),
  status: z.enum(tableStatuses, { error: "Pilih status meja yang valid" }),
  notes: OptionalNotesSchema,
});

export const RestaurantTableUpdateSchema = RestaurantTableCreateSchema.extend({
  id: z.coerce.number().int().positive("Meja wajib dipilih"),
});

export const RestaurantTableIdSchema = z.object({
  id: z.coerce.number().int().positive("Meja wajib dipilih"),
});

export type TableLocationValue = (typeof tableLocations)[number];
export type TableStatusValue = (typeof tableStatuses)[number];
export type RestaurantTableFormInput = z.input<
  typeof RestaurantTableCreateSchema
>;
export type RestaurantTableFormValues = z.output<
  typeof RestaurantTableCreateSchema
>;
