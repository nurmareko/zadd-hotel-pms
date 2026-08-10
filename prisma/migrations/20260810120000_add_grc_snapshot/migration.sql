-- AlterTable
ALTER TABLE "reservation"
ADD COLUMN "grc_snapshot" JSONB,
ADD COLUMN "grc_snapshot_version" INTEGER;
