-- CreateEnum
CREATE TYPE "TableLocation" AS ENUM ('INDOOR', 'OUTDOOR', 'PRIVATE');

-- CreateEnum
CREATE TYPE "TableStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'OUT_OF_SERVICE');

-- AlterTable
ALTER TABLE "fb_order" ADD COLUMN     "guest_count" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "table_id" INTEGER;

-- CreateTable
CREATE TABLE "restaurant_table" (
    "id" SERIAL NOT NULL,
    "number" VARCHAR(10) NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 2,
    "location" "TableLocation" NOT NULL DEFAULT 'INDOOR',
    "status" "TableStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_table_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_table_number_key" ON "restaurant_table"("number");

-- AddForeignKey
ALTER TABLE "fb_order" ADD CONSTRAINT "fb_order_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "restaurant_table"("id") ON DELETE SET NULL ON UPDATE CASCADE;
