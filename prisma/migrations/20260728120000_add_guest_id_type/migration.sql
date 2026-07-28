-- CreateEnum
CREATE TYPE "GuestIdType" AS ENUM ('KTP', 'PASSPORT', 'SIM', 'OTHER');

-- AlterTable
ALTER TABLE "guest" ADD COLUMN "id_type" "GuestIdType";
