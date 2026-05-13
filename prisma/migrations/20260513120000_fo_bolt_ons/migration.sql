-- Rename the previous internal reservation usage enum so the new
-- stakeholder-facing ReservationType enum can use the requested name.
ALTER TYPE "ReservationType" RENAME TO "ReservationUsageType";

-- CreateEnum
CREATE TYPE "ArrangementType" AS ENUM ('RO', 'RB', 'FBM');

-- CreateEnum
CREATE TYPE "ReservationType" AS ENUM ('INDIVIDUAL', 'COMPANY', 'GOVERNMENT', 'OTA', 'WALK_IN');

-- AlterTable
ALTER TABLE "reservation"
  ADD COLUMN "arrangement_type" "ArrangementType" NOT NULL DEFAULT 'RO',
  ADD COLUMN "reservation_type" "ReservationType" NOT NULL DEFAULT 'INDIVIDUAL',
  ADD COLUMN "comment" TEXT;
