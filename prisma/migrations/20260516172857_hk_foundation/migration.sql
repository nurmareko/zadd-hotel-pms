-- AlterEnum
ALTER TYPE "RoomStatus" ADD VALUE 'VCU';

-- AlterTable
ALTER TABLE "housekeeping_log" ADD COLUMN     "cleaning_completed_at" TIMESTAMP(3),
ADD COLUMN     "cleaning_started_at" TIMESTAMP(3);
