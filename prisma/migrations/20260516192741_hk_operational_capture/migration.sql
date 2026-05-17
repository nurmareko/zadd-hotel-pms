-- AlterTable
ALTER TABLE "housekeeping_log" ADD COLUMN     "linen_changed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reported_adult_count" INTEGER,
ADD COLUMN     "reported_child_count" INTEGER,
ADD COLUMN     "towel_changed" BOOLEAN NOT NULL DEFAULT false;
