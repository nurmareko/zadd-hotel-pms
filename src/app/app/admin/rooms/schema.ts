import { RoomStatus } from "@prisma/client";
import { z } from "zod";

export const roomStatuses = [
  RoomStatus.VC,
  RoomStatus.VD,
  RoomStatus.OC,
  RoomStatus.OD,
  RoomStatus.VCU,
  RoomStatus.OOO,
] as const;

const OptionalDescriptionSchema = z
  .string()
  .trim()
  .max(500, "Deskripsi maksimal 500 karakter")
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

export const RoomTypeCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Kode wajib diisi")
    .max(20, "Kode maksimal 20 karakter")
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Kode hanya boleh huruf, angka, underscore, dan tanda hubung",
    )
    .transform((value) => value.toUpperCase()),
  name: z
    .string()
    .trim()
    .min(1, "Nama tipe wajib diisi")
    .min(2, "Nama tipe minimal 2 karakter")
    .max(50, "Nama tipe maksimal 50 karakter"),
  description: OptionalDescriptionSchema,
  capacity: formNumber(
    z
      .number({ error: "Kapasitas wajib diisi dan harus berupa angka" })
      .int("Kapasitas harus bilangan bulat")
      .min(1, "Kapasitas minimal 1"),
  ),
  baseRate: formNumber(
    z
      .number({ error: "Base rate wajib diisi dan harus berupa angka" })
      .min(0, "Base rate tidak boleh negatif"),
  ),
});

export const RoomTypeUpdateSchema = RoomTypeCreateSchema.extend({
  id: z.coerce.number().int().positive("Tipe kamar wajib dipilih"),
});

export const RoomTypeIdSchema = z.object({
  id: z.coerce.number().int().positive("Tipe kamar wajib dipilih"),
});

export const RoomCreateSchema = z.object({
  number: z
    .string()
    .trim()
    .min(1, "Nomor kamar wajib diisi")
    .max(10, "Nomor kamar maksimal 10 karakter")
    .regex(
      /^[A-Za-z0-9]*[0-9][A-Za-z0-9]*$/,
      "Nomor kamar harus alfanumerik dan mengandung angka",
    ),
  floor: formNumber(
    z
      .number({ error: "Lantai wajib diisi dan harus berupa angka" })
      .int("Lantai harus bilangan bulat")
      .min(1, "Lantai minimal 1"),
  ),
  roomTypeId: z.coerce
    .number()
    .int("Tipe kamar tidak valid")
    .positive("Pilih tipe kamar"),
  status: z.enum(roomStatuses, { error: "Pilih status kamar yang valid" }),
});

export const RoomUpdateSchema = RoomCreateSchema.extend({
  id: z.coerce.number().int().positive("Kamar wajib dipilih"),
});

export const RoomIdSchema = z.object({
  id: z.coerce.number().int().positive("Kamar wajib dipilih"),
});

export type RoomStatusValue = (typeof roomStatuses)[number];
