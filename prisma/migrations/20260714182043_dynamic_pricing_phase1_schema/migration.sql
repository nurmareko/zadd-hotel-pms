-- CreateEnum
CREATE TYPE "PricingRuleSelectorKind" AS ENUM ('DAY_OF_WEEK', 'DATE_RANGE');

-- CreateEnum
CREATE TYPE "PricingRuleDayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "PricingRuleAdjustmentKind" AS ENUM ('AMOUNT_DELTA', 'PERCENT_DELTA');

-- CreateEnum
CREATE TYPE "ReservationNightRevenueClass" AS ENUM ('PAID', 'COMP');

-- AlterTable
ALTER TABLE "folio_line_item" ADD COLUMN     "reservation_night_id" TEXT;

-- AlterTable
ALTER TABLE "night_audit" ADD COLUMN     "room_nights_sold" INTEGER;

-- CreateTable
CREATE TABLE "pricing_rule" (
    "id" TEXT NOT NULL,
    "room_type_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "selector_kind" "PricingRuleSelectorKind" NOT NULL,
    "day_of_week" "PricingRuleDayOfWeek",
    "starts_on" DATE,
    "ends_before" DATE,
    "adjustment_kind" "PricingRuleAdjustmentKind" NOT NULL,
    "adjustment_value" DECIMAL(12,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_night" (
    "id" TEXT NOT NULL,
    "reservation_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "rate_amount" DECIMAL(12,2) NOT NULL,
    "revenue_class" "ReservationNightRevenueClass" NOT NULL DEFAULT 'PAID',
    "source_pricing_rule_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_night_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reservation_night_rate_amount_nonnegative" CHECK ("rate_amount" >= 0)
);

-- CreateIndex
CREATE INDEX "pricing_rule_room_type_id_idx" ON "pricing_rule"("room_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_rule_room_type_id_day_of_week_key" ON "pricing_rule"("room_type_id", "day_of_week");

-- CreateIndex
CREATE INDEX "reservation_night_date_idx" ON "reservation_night"("date");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_night_reservation_id_date_key" ON "reservation_night"("reservation_id", "date");

-- AddForeignKey
ALTER TABLE "pricing_rule" ADD CONSTRAINT "pricing_rule_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_night" ADD CONSTRAINT "reservation_night_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folio_line_item" ADD CONSTRAINT "folio_line_item_reservation_night_id_fkey" FOREIGN KEY ("reservation_night_id") REFERENCES "reservation_night"("id") ON DELETE SET NULL ON UPDATE CASCADE;
