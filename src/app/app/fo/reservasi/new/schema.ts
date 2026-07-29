import {
  ArrangementType,
  GuestIdType,
  ReservationType,
} from "@prisma/client";
import { z } from "zod";

function toUtcDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

const DateInputSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal wajib diisi")
  .transform((value, context) => {
    const date = toUtcDateOnly(value);

    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      context.addIssue({
        code: "custom",
        message: "Tanggal tidak valid",
      });

      return z.NEVER;
    }

    return date;
  });

const OptionalTextSchema = z
  .string()
  .trim()
  .max(500, "Maksimal 500 karakter")
  .or(z.literal(""))
  .optional()
  .transform((value) => (value ? value : null));

const RequiredAddressSchema = z
  .string()
  .trim()
  .min(1, "Alamat wajib diisi")
  .max(500, "Alamat maksimal 500 karakter");

const RequiredGuestIdTypeSchema = z.nativeEnum(GuestIdType, {
  error: "Jenis identitas wajib dipilih",
});

const OptionalGuestIdTypeSchema = z
  .union([z.nativeEnum(GuestIdType), z.literal("")])
  .optional()
  .transform((value) => value || null);

const OptionalShortTextSchema = z
  .string()
  .trim()
  .max(100, "Maksimal 100 karakter")
  .or(z.literal(""))
  .optional()
  .transform((value) => (value ? value : null));

const OptionalEmailSchema = z
  .string()
  .trim()
  .email("Format email tidak valid")
  .max(100, "Email maksimal 100 karakter")
  .or(z.literal(""))
  .optional()
  .transform((value) => (value ? value : null));

const OptionalRoomIdSchema = z.preprocess(
  (value) =>
    (typeof value === "string" && value.trim() === "") || value == null
      ? null
      : value,
  z.coerce
    .number("Kamar tidak valid")
    .int("Kamar tidak valid")
    .positive("Kamar tidak valid")
    .nullable(),
);

export type ReservationRoomTypeCapacity = {
  id: number;
  capacity: number;
};

export function reservationCapacityError(totalGuests: number, capacity: number) {
  return `Jumlah tamu (${totalGuests}) melebihi kapasitas tipe kamar (${capacity})`;
}

const CreateReservationObjectSchema = z.object({
    fullName: z
      .string()
      .trim()
      .min(1, "Nama tamu wajib diisi")
      .max(100, "Nama tamu maksimal 100 karakter"),
    idType: RequiredGuestIdTypeSchema,
    idNumber: OptionalShortTextSchema,
    phone: z
      .string()
      .trim()
      .max(20, "Nomor telepon maksimal 20 karakter")
      .or(z.literal(""))
      .optional()
      .transform((value) => (value ? value : null)),
    email: OptionalEmailSchema,
    address: RequiredAddressSchema,
    nationality: z
      .string()
      .trim()
      .max(50, "Kewarganegaraan maksimal 50 karakter")
      .or(z.literal(""))
      .optional()
      .transform((value) => (value ? value : null)),
    roomTypeId: z.coerce
      .number("Tipe kamar wajib dipilih")
      .int("Tipe kamar wajib dipilih")
      .positive("Tipe kamar wajib dipilih"),
    roomId: OptionalRoomIdSchema,
    arrivalDate: DateInputSchema,
    departureDate: DateInputSchema,
    adults: z.coerce
      .number("Jumlah dewasa wajib diisi")
      .int("Jumlah dewasa harus berupa bilangan bulat")
      .min(1, "Minimal 1 dewasa"),
    children: z.coerce
      .number("Jumlah anak wajib diisi")
      .int("Jumlah anak harus berupa bilangan bulat")
      .min(0, "Jumlah anak tidak boleh negatif"),
    reservationType: z.nativeEnum(ReservationType),
    arrangementType: z.nativeEnum(ArrangementType),
    notes: OptionalTextSchema,
});

const EditReservationObjectSchema = CreateReservationObjectSchema.extend({
  idType: OptionalGuestIdTypeSchema,
});

const BaseCreateReservationSchema = CreateReservationObjectSchema.refine(
  (value) => value.departureDate > value.arrivalDate,
  {
    message: "Keberangkatan harus setelah kedatangan",
    path: ["departureDate"],
  },
);

const BaseEditReservationSchema = EditReservationObjectSchema.refine(
  (value) => value.departureDate > value.arrivalDate,
  {
    message: "Keberangkatan harus setelah kedatangan",
    path: ["departureDate"],
  },
);

const ReservationRoomRowSchema = z.object({
  roomTypeId: z.coerce
    .number("Tipe kamar wajib dipilih")
    .int("Tipe kamar wajib dipilih")
    .positive("Tipe kamar wajib dipilih"),
  roomId: OptionalRoomIdSchema,
  adults: z.coerce
    .number("Jumlah dewasa wajib diisi")
    .int("Jumlah dewasa harus berupa bilangan bulat")
    .min(1, "Minimal 1 dewasa"),
  children: z.coerce
    .number("Jumlah anak wajib diisi")
    .int("Jumlah anak harus berupa bilangan bulat")
    .min(0, "Jumlah anak tidak boleh negatif"),
});

const UnifiedRoomFields = {
  rooms: z
    .array(ReservationRoomRowSchema)
    .min(1, "Tambahkan minimal 1 kamar")
    .max(20, "Maksimal 20 kamar per reservasi"),
};

const BaseUnifiedReservationSchema = CreateReservationObjectSchema.omit({
  roomTypeId: true,
  roomId: true,
  adults: true,
  children: true,
})
  .extend(UnifiedRoomFields)
  .refine((value) => value.departureDate > value.arrivalDate, {
    message: "Keberangkatan harus setelah kedatangan",
    path: ["departureDate"],
  });

const BaseUnifiedEditReservationSchema = EditReservationObjectSchema.omit({
  roomTypeId: true,
  roomId: true,
  adults: true,
  children: true,
})
  .extend(UnifiedRoomFields)
  .refine((value) => value.departureDate > value.arrivalDate, {
    message: "Keberangkatan harus setelah kedatangan",
    path: ["departureDate"],
  });

export function createReservationSchema(
  roomTypes: ReservationRoomTypeCapacity[] = [],
) {
  const capacityByRoomTypeId = new Map(
    roomTypes.map((roomType) => [roomType.id, roomType.capacity]),
  );

  return BaseCreateReservationSchema.superRefine((value, context) => {
    const totalGuests = value.adults + value.children;

    if (totalGuests < 1) {
      context.addIssue({
        code: "custom",
        path: ["adults"],
        message: "Jumlah tamu minimal 1",
      });
    }

    const capacity = capacityByRoomTypeId.get(value.roomTypeId);

    if (typeof capacity === "undefined") {
      if (roomTypes.length > 0) {
        context.addIssue({
          code: "custom",
          path: ["roomTypeId"],
          message: "Tipe kamar tidak valid",
        });
      }

      return;
    }

    if (totalGuests > capacity) {
      context.addIssue({
        code: "custom",
        path: ["children"],
        message: reservationCapacityError(totalGuests, capacity),
      });
    }
  });
}

export const CreateReservationSchema = createReservationSchema();

export function createEditReservationSchema(
  roomTypes: ReservationRoomTypeCapacity[] = [],
) {
  const capacityByRoomTypeId = new Map(
    roomTypes.map((roomType) => [roomType.id, roomType.capacity]),
  );

  return BaseEditReservationSchema.superRefine((value, context) => {
    const totalGuests = value.adults + value.children;
    const capacity = capacityByRoomTypeId.get(value.roomTypeId);

    if (totalGuests < 1) {
      context.addIssue({
        code: "custom",
        path: ["adults"],
        message: "Jumlah tamu minimal 1",
      });
    }

    if (typeof capacity === "undefined") {
      if (roomTypes.length > 0) {
        context.addIssue({
          code: "custom",
          path: ["roomTypeId"],
          message: "Tipe kamar tidak valid",
        });
      }

      return;
    }

    if (totalGuests > capacity) {
      context.addIssue({
        code: "custom",
        path: ["children"],
        message: reservationCapacityError(totalGuests, capacity),
      });
    }
  });
}

export function createUnifiedReservationSchema(
  roomTypes: ReservationRoomTypeCapacity[] = [],
) {
  const capacityByRoomTypeId = new Map(
    roomTypes.map((roomType) => [roomType.id, roomType.capacity]),
  );

  return BaseUnifiedReservationSchema.superRefine((value, context) => {
    const selectedRoomIds = new Set<number>();

    value.rooms.forEach((room, index) => {
      const totalGuests = room.adults + room.children;

      if (totalGuests < 1) {
        context.addIssue({
          code: "custom",
          path: ["rooms", index, "adults"],
          message: "Jumlah tamu minimal 1",
        });
      }

      const capacity = capacityByRoomTypeId.get(room.roomTypeId);

      if (typeof capacity === "undefined") {
        if (roomTypes.length > 0) {
          context.addIssue({
            code: "custom",
            path: ["rooms", index, "roomTypeId"],
            message: "Tipe kamar tidak valid",
          });
        }

        return;
      }

      if (totalGuests > capacity) {
        context.addIssue({
          code: "custom",
          path: ["rooms", index, "children"],
          message: reservationCapacityError(totalGuests, capacity),
        });
      }

      if (room.roomId === null) {
        return;
      }

      if (selectedRoomIds.has(room.roomId)) {
        context.addIssue({
          code: "custom",
          path: ["rooms", index, "roomId"],
          message: "Kamar fisik yang sama tidak boleh dipilih dua kali",
        });
      }

      selectedRoomIds.add(room.roomId);
    });
  });
}

export const UnifiedReservationSchema = createUnifiedReservationSchema();

export function createUnifiedEditReservationSchema(
  roomTypes: ReservationRoomTypeCapacity[] = [],
) {
  const capacityByRoomTypeId = new Map(
    roomTypes.map((roomType) => [roomType.id, roomType.capacity]),
  );

  return BaseUnifiedEditReservationSchema.superRefine((value, context) => {
    const selectedRoomIds = new Set<number>();

    value.rooms.forEach((room, index) => {
      const totalGuests = room.adults + room.children;

      if (totalGuests < 1) {
        context.addIssue({
          code: "custom",
          path: ["rooms", index, "adults"],
          message: "Jumlah tamu minimal 1",
        });
      }

      const capacity = capacityByRoomTypeId.get(room.roomTypeId);

      if (typeof capacity === "undefined") {
        if (roomTypes.length > 0) {
          context.addIssue({
            code: "custom",
            path: ["rooms", index, "roomTypeId"],
            message: "Tipe kamar tidak valid",
          });
        }

        return;
      }

      if (totalGuests > capacity) {
        context.addIssue({
          code: "custom",
          path: ["rooms", index, "children"],
          message: reservationCapacityError(totalGuests, capacity),
        });
      }

      if (room.roomId === null) {
        return;
      }

      if (selectedRoomIds.has(room.roomId)) {
        context.addIssue({
          code: "custom",
          path: ["rooms", index, "roomId"],
          message: "Kamar fisik yang sama tidak boleh dipilih dua kali",
        });
      }

      selectedRoomIds.add(room.roomId);
    });
  });
}

export type CreateReservationInput = {
  fullName: string;
  idType: GuestIdType | "";
  idNumber: string;
  phone: string;
  email: string;
  address: string;
  nationality: string;
  roomTypeId: string;
  roomId: string;
  arrivalDate: string;
  departureDate: string;
  adults: string;
  children: string;
  reservationType: ReservationType;
  arrangementType: ArrangementType;
  notes: string;
};

export type UnifiedReservationInput = Omit<
  CreateReservationInput,
  "roomTypeId" | "roomId" | "adults" | "children"
> & {
  rooms: Array<{
    roomTypeId: string;
    roomId: string;
    adults: string;
    children: string;
  }>;
};
export type UnifiedReservationValues = z.output<typeof UnifiedReservationSchema>;

export const EditReservationSchema = createEditReservationSchema();
export type EditReservationValues = z.output<typeof EditReservationSchema>;
