-- Replace the pre-go-live arrangement taxonomy after mapping every stored row.
ALTER TABLE "reservation" ALTER COLUMN "arrangement_type" DROP DEFAULT;

CREATE TYPE "ArrangementType_new" AS ENUM ('RO', 'BB', 'HB', 'FB');

ALTER TABLE "reservation"
ALTER COLUMN "arrangement_type" TYPE "ArrangementType_new"
USING (
  CASE "arrangement_type"::text
    WHEN 'RB' THEN 'BB'
    WHEN 'FBM' THEN 'FB'
    ELSE "arrangement_type"::text
  END
)::"ArrangementType_new";

DROP TYPE "ArrangementType";
ALTER TYPE "ArrangementType_new" RENAME TO "ArrangementType";
ALTER TABLE "reservation" ALTER COLUMN "arrangement_type" SET DEFAULT 'RO';

-- Add nullable per-night meal snapshots. Phase 1 does not populate or read them.
ALTER TABLE "reservation_night"
ADD COLUMN "meal_plan" "ArrangementType",
ADD COLUMN "meal_pax" INTEGER,
ADD COLUMN "meal_unit_price" DECIMAL(12,2),
ADD COLUMN "meal_amount" DECIMAL(12,2);

ALTER TABLE "reservation_night"
ADD CONSTRAINT "reservation_night_meal_pax_nonnegative_check"
CHECK ("meal_pax" IS NULL OR "meal_pax" >= 0),
ADD CONSTRAINT "reservation_night_meal_unit_price_whole_idr_check"
CHECK (
  "meal_unit_price" IS NULL OR
  ("meal_unit_price" >= 0 AND "meal_unit_price" = TRUNC("meal_unit_price"))
),
ADD CONSTRAINT "reservation_night_meal_amount_whole_idr_check"
CHECK (
  "meal_amount" IS NULL OR
  ("meal_amount" >= 0 AND "meal_amount" = TRUNC("meal_amount"))
);

-- Reservation-owned, database-idempotent one-off stay-flexibility fees.
CREATE TYPE "ReservationStayFeeKind" AS ENUM ('EARLY_CHECK_IN', 'LATE_CHECK_OUT');
CREATE TYPE "ReservationStayFeeStatus" AS ENUM ('PENDING', 'POSTED', 'CANCELLED');

CREATE TABLE "reservation_stay_fee" (
  "id" SERIAL NOT NULL,
  "reservation_id" INTEGER NOT NULL,
  "kind" "ReservationStayFeeKind" NOT NULL,
  "unit_price" DECIMAL(12,2) NOT NULL,
  "status" "ReservationStayFeeStatus" NOT NULL DEFAULT 'PENDING',
  "folio_line_item_id" INTEGER,
  "selected_by_id" INTEGER NOT NULL,
  "selected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "posted_at" TIMESTAMP(3),

  CONSTRAINT "reservation_stay_fee_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reservation_stay_fee_unit_price_whole_idr_check"
    CHECK ("unit_price" >= 0 AND "unit_price" = TRUNC("unit_price"))
);

CREATE UNIQUE INDEX "reservation_stay_fee_reservation_id_kind_key"
ON "reservation_stay_fee"("reservation_id", "kind");

CREATE UNIQUE INDEX "reservation_stay_fee_folio_line_item_id_key"
ON "reservation_stay_fee"("folio_line_item_id");

ALTER TABLE "reservation_stay_fee"
ADD CONSTRAINT "reservation_stay_fee_reservation_id_fkey"
FOREIGN KEY ("reservation_id") REFERENCES "reservation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reservation_stay_fee"
ADD CONSTRAINT "reservation_stay_fee_folio_line_item_id_fkey"
FOREIGN KEY ("folio_line_item_id") REFERENCES "folio_line_item"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reservation_stay_fee"
ADD CONSTRAINT "reservation_stay_fee_selected_by_id_fkey"
FOREIGN KEY ("selected_by_id") REFERENCES "user"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
