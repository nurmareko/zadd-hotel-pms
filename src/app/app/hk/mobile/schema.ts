import { z } from "zod";
import { AmenitiesCountSchema } from "@/lib/housekeeping/amenities";

export const MobileRoomIdSchema = z.number({ error: "Invalid room" })
  .int("Invalid room").positive("Invalid room").max(2147483647, "Invalid room");
const FormRoomIdSchema = z.string({ error: "Invalid room" })
  .regex(/^\d+$/, "Invalid room").transform(Number).pipe(MobileRoomIdSchema);
const NotesSchema = z.string({ error: "Invalid notes" }).trim()
  .max(500, "Notes must not exceed 500 characters").optional();
const CheckboxSchema = z.union([
  z.enum(["on", "true", "1", "yes"]).transform(() => true),
  z.enum(["off", "false", "0", "no", ""]).transform(() => false),
], { error: "Invalid selection" }).optional().transform((value) => value ?? false);

export const MobileFinishSchema = z.object({
  roomId: FormRoomIdSchema,
  linenChanged: CheckboxSchema,
  towelChanged: CheckboxSchema,
  note: NotesSchema,
  towels: AmenitiesCountSchema,
  shampoo: AmenitiesCountSchema,
  soap: AmenitiesCountSchema,
  dentalKit: AmenitiesCountSchema,
  bottledWater: AmenitiesCountSchema,
});
export const MobileInspectSchema = z.object({
  roomId: MobileRoomIdSchema,
  passed: z.boolean({ error: "Invalid inspection result" }),
  notes: NotesSchema,
});
export const FloorLostFoundSchema = z.object({
  roomId: z.preprocess((value) => value === undefined || value === "" ? null : value,
    FormRoomIdSchema.nullable()),
  description: z.string({ error: "A description is required" }).trim()
    .min(3, "The description must be at least 3 characters").max(500, "The description must not exceed 500 characters"),
});
