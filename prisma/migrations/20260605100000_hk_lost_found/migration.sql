-- CreateEnum
CREATE TYPE "LostFoundStatus" AS ENUM ('UNCLAIMED', 'RETURNED');

-- CreateTable
CREATE TABLE "lost_found_item" (
    "id" SERIAL NOT NULL,
    "room_id" INTEGER,
    "description" TEXT NOT NULL,
    "found_by_id" INTEGER NOT NULL,
    "status" "LostFoundStatus" NOT NULL DEFAULT 'UNCLAIMED',
    "returned_at" TIMESTAMP(3),
    "resolution" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lost_found_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lost_found_item_status_idx" ON "lost_found_item"("status");

-- CreateIndex
CREATE INDEX "lost_found_item_room_id_idx" ON "lost_found_item"("room_id");

-- AddForeignKey
ALTER TABLE "lost_found_item" ADD CONSTRAINT "lost_found_item_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lost_found_item" ADD CONSTRAINT "lost_found_item_found_by_id_fkey" FOREIGN KEY ("found_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
