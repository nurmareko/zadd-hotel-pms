import { ArrangementType, ReservationType } from "@prisma/client";
import { z } from "zod";

function toUtcDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

const DateInputSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required")
  .transform((value, context) => {
    const date = toUtcDateOnly(value);

    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      context.addIssue({
        code: "custom",
        message: "Date is invalid",
      });

      return z.NEVER;
    }

    return date;
  });

const OptionalTextSchema = z
  .string()
  .trim()
  .max(500, "Must be 500 characters or fewer")
  .or(z.literal(""))
  .optional()
  .transform((value) => (value ? value : null));

const OptionalShortTextSchema = z
  .string()
  .trim()
  .max(100, "Must be 100 characters or fewer")
  .or(z.literal(""))
  .optional()
  .transform((value) => (value ? value : null));

const OptionalEmailSchema = z
  .string()
  .trim()
  .email("Email is invalid")
  .max(100, "Email must be 100 characters or fewer")
  .or(z.literal(""))
  .optional()
  .transform((value) => (value ? value : null));

const OptionalRoomIdSchema = z.preprocess(
  (value) =>
    (typeof value === "string" && value.trim() === "") || value == null
      ? null
      : value,
  z.coerce
    .number("Room is invalid")
    .int("Room is invalid")
    .positive("Room is invalid")
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
      .min(1, "Guest name is required")
      .max(100, "Guest name must be 100 characters or fewer"),
    idNumber: OptionalShortTextSchema,
    phone: z
      .string()
      .trim()
      .max(20, "Phone must be 20 characters or fewer")
      .or(z.literal(""))
      .optional()
      .transform((value) => (value ? value : null)),
    email: OptionalEmailSchema,
    address: OptionalTextSchema,
    nationality: z
      .string()
      .trim()
      .max(50, "Nationality must be 50 characters or fewer")
      .or(z.literal(""))
      .optional()
      .transform((value) => (value ? value : null)),
    roomTypeId: z.coerce
      .number("Room type is required")
      .int("Room type is required")
      .positive("Room type is required"),
    roomId: OptionalRoomIdSchema,
    arrivalDate: DateInputSchema,
    departureDate: DateInputSchema,
    adults: z.coerce
      .number("Adults is required")
      .int("Adults must be a whole number")
      .min(1, "At least one adult is required"),
    children: z.coerce
      .number("Children is required")
      .int("Children must be a whole number")
      .min(0, "Children cannot be negative"),
    reservationType: z.nativeEnum(ReservationType),
    arrangementType: z.nativeEnum(ArrangementType),
    deposit: z.coerce
      .number("Deposit is required")
      .int("Deposit must be whole rupiah")
      .min(0, "Deposit cannot be negative"),
    notes: OptionalTextSchema,
});

const BaseCreateReservationSchema = CreateReservationObjectSchema.refine(
  (value) => value.departureDate > value.arrivalDate,
  {
    message: "Departure must be after arrival",
    path: ["departureDate"],
  },
);

const ReservationRoomRowSchema = z.object({
  roomTypeId: z.coerce
    .number("Room type is required")
    .int("Room type is required")
    .positive("Room type is required"),
  roomId: OptionalRoomIdSchema,
  adults: z.coerce
    .number("Adults is required")
    .int("Adults must be a whole number")
    .min(1, "At least one adult is required"),
  children: z.coerce
    .number("Children is required")
    .int("Children must be a whole number")
    .min(0, "Children cannot be negative"),
});

const BaseUnifiedReservationSchema = CreateReservationObjectSchema.omit({
  roomTypeId: true,
  roomId: true,
  adults: true,
  children: true,
})
  .extend({
    rooms: z
      .array(ReservationRoomRowSchema)
      .min(1, "Tambahkan minimal 1 kamar")
      .max(20, "Booking maksimal 20 kamar"),
  })
  .refine((value) => value.departureDate > value.arrivalDate, {
    message: "Departure must be after arrival",
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

export type CreateReservationInput = {
  fullName: string;
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
  deposit: string;
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

export const EditReservationSchema = CreateReservationSchema;
export type EditReservationValues = z.output<typeof EditReservationSchema>;
