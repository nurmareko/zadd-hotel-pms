import {
  ArrangementType,
  GuestIdType,
  ReservationStayFeeKind,
  ReservationType,
} from "@prisma/client";
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
        message: "Invalid date",
      });

      return z.NEVER;
    }

    return date;
  });

const OptionalTextSchema = z
  .string()
  .trim()
  .max(500, "Maximum 500 characters")
  .or(z.literal(""))
  .optional()
  .transform((value) => (value ? value : null));

const OptionalAddressSchema = z
  .string()
  .trim()
  .max(500, "Address must not exceed 500 characters")
  .or(z.literal(""))
  .optional()
  .transform((value) => (value ? value : null));

const RequiredGuestIdTypeSchema = z.nativeEnum(GuestIdType, {
  error: "ID type is required",
});

const OptionalGuestIdTypeSchema = z
  .union([z.nativeEnum(GuestIdType), z.literal("")])
  .optional()
  .transform((value) => value || null);

const OptionalShortTextSchema = z
  .string()
  .trim()
  .max(100, "Maximum 100 characters")
  .or(z.literal(""))
  .optional()
  .transform((value) => (value ? value : null));

const OptionalEmailSchema = z
  .string()
  .trim()
  .email("Email format is invalid")
  .max(100, "Email must not exceed 100 characters")
  .or(z.literal(""))
  .optional()
  .transform((value) => (value ? value : null));

const OptionalRoomIdSchema = z.preprocess(
  (value) =>
    (typeof value === "string" && value.trim() === "") || value == null
      ? null
      : value,
  z.coerce
    .number("Invalid room")
    .int("Invalid room")
    .positive("Invalid room")
    .nullable(),
);

export type ReservationRoomTypeCapacity = {
  id: number;
  capacity: number;
};

export function reservationCapacityError(totalGuests: number, capacity: number) {
  return `Guest count (${totalGuests}) exceeds the room type capacity (${capacity})`;
}

const CreateReservationObjectSchema = z.object({
    guestId: z.coerce.number().int().positive().nullable().optional(),
    fullName: z
      .string()
      .trim()
      .min(1, "Guest name is required")
      .max(100, "Guest name must not exceed 100 characters"),
    idType: RequiredGuestIdTypeSchema,
    idNumber: OptionalShortTextSchema,
    phone: z
      .string()
      .trim()
      .max(20, "Phone number must not exceed 20 characters")
      .or(z.literal(""))
      .optional()
      .transform((value) => (value ? value : null)),
    email: OptionalEmailSchema,
    address: OptionalAddressSchema,
    nationality: z
      .string()
      .trim()
      .max(50, "Nationality must not exceed 50 characters")
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
      .number("Adult count is required")
      .int("Adult count must be a whole number")
      .min(1, "Minimum 1 adult"),
    children: z.coerce
      .number("Child count is required")
      .int("Child count must be a whole number")
      .min(0, "Child count cannot be negative"),
    reservationType: z.nativeEnum(ReservationType),
    arrangementType: z.nativeEnum(ArrangementType),
    notes: OptionalTextSchema,
});

const EditReservationObjectSchema = CreateReservationObjectSchema.extend({
  idType: OptionalGuestIdTypeSchema,
});



const BaseEditReservationSchema = EditReservationObjectSchema.refine(
  (value) => value.departureDate > value.arrivalDate,
  {
    message: "Departure must be after arrival",
    path: ["departureDate"],
  },
);

export const OptionalCustomRateSchema = z.preprocess(
  (value) => typeof value === "string"
    ? (value.trim() === "" ? undefined : Number(value))
    : value,
  z.number("Custom rate must be a number")
    .int("Custom rate must be a whole number")
    .min(0, "Custom rate cannot be negative")
    .max(100_000_000, "Custom rate must not exceed 100,000,000")
    .optional(),
);

const ReservationRoomRowSchema = z.object({
  customRate: OptionalCustomRateSchema,
  customRateReason: z.string("Custom rate reason is invalid").trim()
    .max(255, "Custom rate reason must not exceed 255 characters")
    .optional()
    .transform((value) => value || undefined),
  occupantName: z.string().trim().max(100, "Guest name must not exceed 100 characters").optional(),
  roomTypeId: z.coerce
    .number("Room type is required")
    .int("Room type is required")
    .positive("Room type is required"),
  roomId: OptionalRoomIdSchema,
  adults: z.coerce
    .number("Adult count is required")
    .int("Adult count must be a whole number")
    .min(1, "Minimum 1 adult"),
  children: z.coerce
    .number("Child count is required")
    .int("Child count must be a whole number")
    .min(0, "Child count cannot be negative"),
});

const UnifiedRoomFields = {
  rooms: z
    .array(ReservationRoomRowSchema)
    .min(1, "Add at least 1 room")
    .max(20, "Maximum 20 rooms per reservation"),
  stayFeeKinds: z
    .array(z.nativeEnum(ReservationStayFeeKind))
    .max(2, "Maximum two stay flexibility fees")
    .refine((kinds) => new Set(kinds).size === kinds.length, {
      message: "Stay flexibility fee types must not be duplicated",
    })
    .optional()
    .default([]),
};

const BaseUnifiedReservationSchema = CreateReservationObjectSchema.omit({
  roomTypeId: true,
  roomId: true,
  adults: true,
  children: true,
})
  .extend(UnifiedRoomFields)
  .refine((value) => value.departureDate > value.arrivalDate, {
    message: "Departure must be after arrival",
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
    message: "Departure must be after arrival",
    path: ["departureDate"],
  });



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
        message: "Guest count must be at least 1",
      });
    }

    if (typeof capacity === "undefined") {
      if (roomTypes.length > 0) {
        context.addIssue({
          code: "custom",
          path: ["roomTypeId"],
          message: "Room type is invalid",
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
          message: "Guest count must be at least 1",
        });
      }

      const capacity = capacityByRoomTypeId.get(room.roomTypeId);

      if (typeof capacity === "undefined") {
        if (roomTypes.length > 0) {
          context.addIssue({
            code: "custom",
            path: ["rooms", index, "roomTypeId"],
            message: "Room type is invalid",
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
          message: "The same physical room cannot be selected twice",
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
          message: "Guest count must be at least 1",
        });
      }

      const capacity = capacityByRoomTypeId.get(room.roomTypeId);

      if (typeof capacity === "undefined") {
        if (roomTypes.length > 0) {
          context.addIssue({
            code: "custom",
            path: ["rooms", index, "roomTypeId"],
            message: "Room type is invalid",
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
          message: "The same physical room cannot be selected twice",
        });
      }

      selectedRoomIds.add(room.roomId);
    });
  });
}

export type CreateReservationInput = {
  guestId?: number | null;
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
  stayFeeKinds?: ReservationStayFeeKind[];
};

export type UnifiedReservationInput = Omit<
  CreateReservationInput,
  "roomTypeId" | "roomId" | "adults" | "children"
> & {
  rooms: Array<{
    occupantName?: string;
    customRate?: string;
    customRateReason?: string;
    roomTypeId: string;
    roomId: string;
    adults: string;
    children: string;
  }>;
};
export type UnifiedReservationValues = z.output<typeof UnifiedReservationSchema>;

export const EditReservationSchema = createEditReservationSchema();
export type EditReservationValues = z.output<typeof EditReservationSchema>;
