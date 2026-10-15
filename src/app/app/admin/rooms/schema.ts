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
  .max(500, "Description must not exceed 500 characters")
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
    .min(1, "Code is required")
    .max(20, "Code must not exceed 20 characters")
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Code may contain only letters, numbers, underscores and hyphens",
    )
    .transform((value) => value.toUpperCase()),
  name: z
    .string()
    .trim()
    .min(1, "Room type name is required")
    .min(2, "Room type name must contain at least 2 characters")
    .max(50, "Room type name must not exceed 50 characters"),
  description: OptionalDescriptionSchema,
  capacity: formNumber(
    z
      .number({ error: "Capacity is required and must be a number" })
      .int("Capacity must be a whole number")
      .min(1, "Capacity must be at least 1"),
  ),
  baseRate: formNumber(
    z
      .number({ error: "Base rate is required and must be a number" })
      .positive("Base rate must be greater than 0"),
  ),
});

export const RoomTypeUpdateSchema = RoomTypeCreateSchema.extend({
  id: z.coerce.number().int().positive("Select a room type"),
});

export const RoomTypeIdSchema = z.object({
  id: z.coerce.number().int().positive("Select a room type"),
});

export const RoomCreateSchema = z.object({
  number: z
    .string()
    .trim()
    .min(1, "Room number is required")
    .max(10, "Room number must not exceed 10 characters")
    .regex(
      /^[A-Za-z0-9]*[0-9][A-Za-z0-9]*$/,
      "Room number must be alphanumeric and contain a number",
    ),
  floor: formNumber(
    z
      .number({ error: "Floor is required and must be a number" })
      .int("Floor must be a whole number")
      .min(1, "Floor must be at least 1"),
  ),
  roomTypeId: z.coerce
    .number()
    .int("Invalid room type")
    .positive("Select a room type"),
  status: z.enum(roomStatuses, { error: "Select a valid room status" }),
});

export const RoomUpdateSchema = RoomCreateSchema.extend({
  id: z.coerce.number().int().positive("Select a room"),
});

export const RoomIdSchema = z.object({
  id: z.coerce.number().int().positive("Select a room"),
});

export type RoomStatusValue = (typeof roomStatuses)[number];
