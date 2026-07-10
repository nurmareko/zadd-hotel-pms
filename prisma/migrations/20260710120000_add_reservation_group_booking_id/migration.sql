ALTER TABLE "reservation" ADD COLUMN "group_booking_id" VARCHAR(32);

CREATE INDEX "reservation_group_booking_id_idx" ON "reservation"("group_booking_id");
