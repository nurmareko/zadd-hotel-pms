CREATE TYPE "ActivityAction" AS ENUM (
  'RESERVATION_CREATED',
  'RESERVATION_UPDATED',
  'RESERVATION_CANCELLED',
  'CHECK_IN_COMPLETED',
  'CHECK_OUT_COMPLETED',
  'PAYMENT_RECORDED',
  'FOLIO_CHARGE_POSTED'
);

CREATE TABLE "activity_log" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "action" "ActivityAction" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reservation_id" INTEGER,
  "folio_id" INTEGER,
  "room_id" INTEGER,
  "metadata" JSONB,

  CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "activity_log_user_id_idx" ON "activity_log"("user_id");
CREATE INDEX "activity_log_action_idx" ON "activity_log"("action");
CREATE INDEX "activity_log_created_at_idx" ON "activity_log"("created_at");

ALTER TABLE "activity_log"
ADD CONSTRAINT "activity_log_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "user"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "activity_log"
ADD CONSTRAINT "activity_log_reservation_id_fkey"
FOREIGN KEY ("reservation_id") REFERENCES "reservation"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "activity_log"
ADD CONSTRAINT "activity_log_folio_id_fkey"
FOREIGN KEY ("folio_id") REFERENCES "folio"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "activity_log"
ADD CONSTRAINT "activity_log_room_id_fkey"
FOREIGN KEY ("room_id") REFERENCES "room"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
