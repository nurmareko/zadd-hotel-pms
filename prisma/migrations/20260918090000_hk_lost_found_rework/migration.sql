BEGIN;

-- Fail rather than wait indefinitely for live operations to release the table.
SET LOCAL lock_timeout = '10s';
LOCK TABLE "lost_found_item" IN ACCESS EXCLUSIVE MODE;

ALTER TYPE "LostFoundStatus" ADD VALUE 'DISPOSED';
CREATE TYPE "LostFoundCategory" AS ENUM ('ELECTRONICS', 'CLOTHING', 'DOCUMENTS', 'VALUABLES', 'ACCESSORIES', 'OTHER');

-- Reference codes must be populated before the required constraint is applied.
ALTER TABLE "lost_found_item"
    ADD COLUMN "reference_code" TEXT,
    ADD COLUMN "category" "LostFoundCategory" NOT NULL DEFAULT 'OTHER',
    ADD COLUMN "location_details" TEXT,
    ADD COLUMN "claimant_name" TEXT,
    ADD COLUMN "claimant_phone" TEXT,
    ADD COLUMN "claimant_id_number" TEXT,
    ADD COLUMN "returned_by_id" INTEGER,
    ADD COLUMN "disposed_by_id" INTEGER,
    ADD COLUMN "disposed_at" TIMESTAMP(3),
    ADD COLUMN "disposal_reason" TEXT;

-- Prisma timestamps are UTC without a SQL timezone. Derive the hotel month
-- explicitly, independent of the database session timezone.
WITH hotel_months AS (
    SELECT "id", "created_at",
        to_char("created_at" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta', 'YYYYMM') AS hotel_month
    FROM "lost_found_item"
), numbered AS (
    SELECT "id", hotel_month,
        row_number() OVER (PARTITION BY hotel_month ORDER BY "created_at", "id") AS sequence
    FROM hotel_months
)
UPDATE "lost_found_item" AS item
SET "reference_code" = 'LF-' || numbered.hotel_month || '-' ||
    lpad(numbered.sequence::text, GREATEST(4, length(numbered.sequence::text)), '0')
FROM numbered
WHERE item."id" = numbered."id";

ALTER TABLE "lost_found_item" ALTER COLUMN "reference_code" SET NOT NULL;
CREATE UNIQUE INDEX "lost_found_item_reference_code_key" ON "lost_found_item"("reference_code");
CREATE INDEX "lost_found_item_category_idx" ON "lost_found_item"("category");
CREATE INDEX "lost_found_item_created_at_idx" ON "lost_found_item"("created_at");
-- Existing status and room indexes are retained.

ALTER TABLE "lost_found_item" ADD CONSTRAINT "lost_found_item_returned_by_id_fkey"
    FOREIGN KEY ("returned_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lost_found_item" ADD CONSTRAINT "lost_found_item_disposed_by_id_fkey"
    FOREIGN KEY ("disposed_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
