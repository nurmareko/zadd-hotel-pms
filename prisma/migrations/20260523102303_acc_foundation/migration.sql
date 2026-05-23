-- Normalize the MVP night audit foundation to one completed snapshot per business date.
CREATE UNIQUE INDEX IF NOT EXISTS "night_audit_business_date_key" ON "night_audit"("business_date");

UPDATE "night_audit"
SET "status" = 'COMPLETED'
WHERE "status"::text <> 'COMPLETED';

UPDATE "night_audit"
SET
  "total_revenue" = COALESCE("total_revenue", 0),
  "occupancy_rate" = COALESCE("occupancy_rate", 0);

ALTER TABLE "night_audit"
  ADD COLUMN "total_rooms" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "rooms_occupied" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "room_revenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "fb_revenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "other_revenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "check_in_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "check_out_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "in_house_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "night_audit"
  ALTER COLUMN "total_revenue" SET NOT NULL,
  ALTER COLUMN "occupancy_rate" SET NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'COMPLETED',
  DROP COLUMN "report_data";

ALTER TABLE "night_audit"
  ALTER COLUMN "total_rooms" DROP DEFAULT,
  ALTER COLUMN "rooms_occupied" DROP DEFAULT,
  ALTER COLUMN "room_revenue" DROP DEFAULT,
  ALTER COLUMN "fb_revenue" DROP DEFAULT,
  ALTER COLUMN "other_revenue" DROP DEFAULT,
  ALTER COLUMN "check_in_count" DROP DEFAULT,
  ALTER COLUMN "check_out_count" DROP DEFAULT,
  ALTER COLUMN "in_house_count" DROP DEFAULT;

ALTER TYPE "NightAuditStatus" RENAME TO "NightAuditStatus_old";
CREATE TYPE "NightAuditStatus" AS ENUM ('COMPLETED');
ALTER TABLE "night_audit"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "NightAuditStatus" USING ("status"::text::"NightAuditStatus"),
  ALTER COLUMN "status" SET DEFAULT 'COMPLETED';
DROP TYPE "NightAuditStatus_old";
