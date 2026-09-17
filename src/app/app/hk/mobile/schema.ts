import { z } from "zod";

export const MobileRoomIdSchema = z.number({ error: "Kamar tidak valid" })
  .int("Kamar tidak valid").positive("Kamar tidak valid").max(2147483647, "Kamar tidak valid");
const FormRoomIdSchema = z.string({ error: "Kamar tidak valid" })
  .regex(/^\d+$/, "Kamar tidak valid").transform(Number).pipe(MobileRoomIdSchema);
const NotesSchema = z.string({ error: "Catatan tidak valid" }).trim()
  .max(500, "Catatan maksimal 500 karakter").optional();
const CheckboxSchema = z.union([
  z.enum(["on", "true", "1", "yes"]).transform(() => true),
  z.enum(["off", "false", "0", "no", ""]).transform(() => false),
], { error: "Pilihan tidak valid" }).optional().transform((value) => value ?? false);

export const MobileFinishSchema = z.object({
  roomId: FormRoomIdSchema,
  linenChanged: CheckboxSchema,
  towelChanged: CheckboxSchema,
  note: NotesSchema,
});
export const MobileInspectSchema = z.object({
  roomId: MobileRoomIdSchema,
  passed: z.boolean({ error: "Hasil inspeksi tidak valid" }),
  notes: NotesSchema,
});
export const FloorLostFoundSchema = z.object({
  roomId: z.preprocess((value) => value === undefined || value === "" ? null : value,
    FormRoomIdSchema.nullable()),
  description: z.string({ error: "Deskripsi wajib diisi" }).trim()
    .min(3, "Deskripsi minimal 3 karakter").max(500, "Deskripsi maksimal 500 karakter"),
});
