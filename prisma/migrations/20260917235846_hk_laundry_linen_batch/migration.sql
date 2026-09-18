-- CreateEnum
CREATE TYPE "LinenItemType" AS ENUM ('BED_SHEET', 'DUVET_COVER', 'PILLOW_CASE', 'BATH_TOWEL', 'HAND_TOWEL', 'BATH_MAT', 'OTHER');

-- CreateEnum
CREATE TYPE "LinenBatchStatus" AS ENUM ('SENT', 'WASHING', 'CLEAN');

-- CreateTable
CREATE TABLE "linen_batch" (
    "id" TEXT NOT NULL,
    "batch_code" TEXT NOT NULL,
    "item_type" "LinenItemType" NOT NULL,
    "sent_quantity" INTEGER NOT NULL,
    "received_quantity" INTEGER,
    "damaged_quantity" INTEGER NOT NULL DEFAULT 0,
    "status" "LinenBatchStatus" NOT NULL DEFAULT 'SENT',
    "vendor" TEXT,
    "notes" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "recorded_by_id" INTEGER NOT NULL,
    "received_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "linen_batch_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "linen_batch_nonnegative_quantities_check" CHECK (
        "sent_quantity" >= 0
        AND ("received_quantity" IS NULL OR "received_quantity" >= 0)
        AND "damaged_quantity" >= 0
    ),
    CONSTRAINT "linen_batch_reconciliation_check" CHECK (
        COALESCE("received_quantity", 0)::BIGINT + "damaged_quantity"::BIGINT <= "sent_quantity"::BIGINT
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "linen_batch_batch_code_key" ON "linen_batch"("batch_code");

-- CreateIndex
CREATE INDEX "linen_batch_status_sent_at_idx" ON "linen_batch"("status", "sent_at");

-- CreateIndex
CREATE INDEX "linen_batch_item_type_idx" ON "linen_batch"("item_type");

-- AddForeignKey
ALTER TABLE "linen_batch" ADD CONSTRAINT "linen_batch_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linen_batch" ADD CONSTRAINT "linen_batch_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
