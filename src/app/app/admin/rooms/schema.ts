import { RoomStatus } from "@prisma/client";
import { z } from "zod";

export const roomStatuses = [
  RoomStatus.VC,
  RoomStatus.VD,
  RoomStatus.OC,
  RoomStatus.OD,
  RoomStatus.OOO,
] as const;

const OptionalDescriptionSchema = z
  .string()
  .trim()
  .max(500, "Description must be 500 characters or fewer")
  .or(z.literal(""))
  .optional()
  .transform((value) => (value ? value : null));

export const RoomTypeCreateSchema = z.object({
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
    .max(50, "Name must be 50 characters or fewer"),
  description: OptionalDescriptionSchema,
  capacity: z.coerce
    .number("Capacity is required")
    .int("Capacity must be a whole number")
    .min(1, "Capacity must be at least 1"),
  baseRate: z.coerce
    .number("Base rate is required")
    .min(0, "Base rate must be at least 0"),
});

export const RoomTypeUpdateSchema = RoomTypeCreateSchema.extend({
  id: z.coerce.number().int().positive("Room type is required"),
});

export const RoomTypeIdSchema = z.object({
  id: z.coerce.number().int().positive("Room type is required"),
});

export const RoomCreateSchema = z.object({
  number: z
    .string()
    .trim()
    .min(1, "Number is required")
    .max(10, "Number must be 10 characters or fewer"),
  floor: z.coerce
    .number("Floor is required")
    .int("Floor must be a whole number"),
  roomTypeId: z.coerce.number().int().positive("Room type is required"),
  status: z.enum(roomStatuses),
});

export const RoomUpdateSchema = RoomCreateSchema.extend({
  id: z.coerce.number().int().positive("Room is required"),
});

export const RoomIdSchema = z.object({
  id: z.coerce.number().int().positive("Room is required"),
});

export type RoomStatusValue = (typeof roomStatuses)[number];
export type RoomTypeCreateInput = z.input<typeof RoomTypeCreateSchema>;
export type RoomTypeCreateValues = z.output<typeof RoomTypeCreateSchema>;
export type RoomCreateInput = z.input<typeof RoomCreateSchema>;
export type RoomCreateValues = z.output<typeof RoomCreateSchema>;
