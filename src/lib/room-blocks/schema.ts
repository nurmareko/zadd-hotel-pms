import { RoomBlockReason } from "@prisma/client";
import { z } from "zod";
import { isValidISODateOnly } from "@/lib/date-only";

const id = z.coerce.number().int().positive();
const date = z.string().refine(isValidISODateOnly, "Date must be a valid calendar date (YYYY-MM-DD).");
export const CreateRoomBlockSchema = z.object({
  roomId: id,
  startDate: date,
  endDate: date,
  reason: z.nativeEnum(RoomBlockReason).default(RoomBlockReason.MAINTENANCE),
  note: z.string().trim().max(2000, "Notes must be at most 2000 characters.").optional(),
}).refine((value) => value.startDate < value.endDate, {
  path: ["endDate"],
  message: "End date must be after the start date.",
});
export const ReleaseRoomBlockSchema = z.object({ blockId: id });
export type CreateRoomBlockInput = {
  roomId: number | string;
  startDate: string;
  endDate: string;
  reason?: RoomBlockReason;
  note?: string;
};
export type CreateRoomBlockValues = z.output<typeof CreateRoomBlockSchema>;
export type ReleaseRoomBlockInput = { blockId: number | string };
