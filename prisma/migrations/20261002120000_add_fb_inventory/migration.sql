-- CreateEnum
CREATE TYPE "FBStockMovementType" AS ENUM ('RECEIVE', 'STOCK_TAKE', 'WASTAGE', 'CONSUMPTION');

-- CreateTable
CREATE TABLE "fb_ingredient" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "on_hand" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "par_level" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "menu_item_id" INTEGER,
    "location" VARCHAR(50),
    "last_counted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fb_ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fb_stock_ledger" (
    "id" SERIAL NOT NULL,
    "ingredient_id" INTEGER NOT NULL,
    "type" "FBStockMovementType" NOT NULL,
    "quantity_delta" DECIMAL(10,3) NOT NULL,
    "balance_after" DECIMAL(10,3) NOT NULL,
    "notes" VARCHAR(255),
    "recorded_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fb_stock_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fb_stock_ledger_ingredient_id_created_at_idx" ON "fb_stock_ledger"("ingredient_id", "created_at");

-- AddForeignKey
ALTER TABLE "fb_ingredient" ADD CONSTRAINT "fb_ingredient_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fb_stock_ledger" ADD CONSTRAINT "fb_stock_ledger_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "fb_ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fb_stock_ledger" ADD CONSTRAINT "fb_stock_ledger_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
