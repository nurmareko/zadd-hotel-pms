-- CreateEnum
CREATE TYPE "RoomBlockReason" AS ENUM ('MAINTENANCE', 'RENOVATION', 'DEEP_CLEANING', 'INSPECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "RoomBlockStatus" AS ENUM ('ACTIVE', 'RELEASED');

-- CreateTable
CREATE TABLE "room_block" (
    "id" SERIAL NOT NULL,
    "room_id" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "reason" "RoomBlockReason" NOT NULL DEFAULT 'MAINTENANCE',
    "status" "RoomBlockStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_block_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "room_block_room_id_status_start_date_end_date_idx" ON "room_block"("room_id", "status", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "room_block_start_date_end_date_status_idx" ON "room_block"("start_date", "end_date", "status");

-- AddForeignKey
ALTER TABLE "room_block" ADD CONSTRAINT "room_block_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_block" ADD CONSTRAINT "room_block_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
