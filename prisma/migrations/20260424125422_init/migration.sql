-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('VC', 'VD', 'OC', 'OD', 'OOO');

-- CreateEnum
CREATE TYPE "ArticleType" AS ENUM ('ROOM', 'FB', 'SERVICE', 'TAX', 'MISC');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ReservationType" AS ENUM ('REGULAR', 'WALK_IN');

-- CreateEnum
CREATE TYPE "FolioStatus" AS ENUM ('OPEN', 'CLOSED', 'VOIDED');

-- CreateEnum
CREATE TYPE "FBOrderStatus" AS ENUM ('OPEN', 'BILLED', 'CLOSED', 'VOIDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'CARD', 'CHARGE_TO_ROOM');

-- CreateEnum
CREATE TYPE "NightAuditStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "user" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(100),
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "permissions" JSONB NOT NULL,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_role" (
    "user_id" INTEGER NOT NULL,
    "role_id" INTEGER NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_role_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "room_type" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "capacity" INTEGER NOT NULL,
    "base_rate" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "room_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room" (
    "id" SERIAL NOT NULL,
    "number" VARCHAR(10) NOT NULL,
    "floor" INTEGER NOT NULL,
    "room_type_id" INTEGER NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'VC',

    CONSTRAINT "room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" "ArticleType" NOT NULL,
    "default_price" DECIMAL(12,2),

    CONSTRAINT "article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "hotel_name" VARCHAR(100) NOT NULL,
    "address" TEXT,
    "tax_percent" DECIMAL(5,2) NOT NULL,
    "service_charge_percent" DECIMAL(5,2) NOT NULL,
    "night_audit_time" VARCHAR(5) NOT NULL,
    "currency" VARCHAR(5) NOT NULL DEFAULT 'IDR',

    CONSTRAINT "hotel_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest" (
    "id" SERIAL NOT NULL,
    "full_name" VARCHAR(100) NOT NULL,
    "id_number" VARCHAR(50),
    "phone" VARCHAR(20),
    "email" VARCHAR(100),
    "address" TEXT,
    "nationality" VARCHAR(50),
    "birth_date" DATE,

    CONSTRAINT "guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation" (
    "id" SERIAL NOT NULL,
    "reservation_no" VARCHAR(20) NOT NULL,
    "type" "ReservationType" NOT NULL DEFAULT 'REGULAR',
    "guest_id" INTEGER NOT NULL,
    "room_type_id" INTEGER NOT NULL,
    "room_id" INTEGER,
    "arrival_date" DATE NOT NULL,
    "departure_date" DATE NOT NULL,
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children" INTEGER NOT NULL DEFAULT 0,
    "status" "ReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "rate_amount" DECIMAL(12,2) NOT NULL,
    "deposit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "grc_filled_at" TIMESTAMP(3),
    "purpose_of_visit" VARCHAR(100),
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folio" (
    "id" SERIAL NOT NULL,
    "folio_no" VARCHAR(20) NOT NULL,
    "reservation_id" INTEGER NOT NULL,
    "status" "FolioStatus" NOT NULL DEFAULT 'OPEN',
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "folio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folio_line_item" (
    "id" SERIAL NOT NULL,
    "folio_id" INTEGER NOT NULL,
    "article_id" INTEGER NOT NULL,
    "fb_order_id" INTEGER,
    "description" VARCHAR(255) NOT NULL,
    "quantity" DECIMAL(8,2) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "posted_by_id" INTEGER NOT NULL,
    "posted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folio_line_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_item" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "menu_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fb_order" (
    "id" SERIAL NOT NULL,
    "order_no" VARCHAR(20) NOT NULL,
    "table_no" VARCHAR(10),
    "status" "FBOrderStatus" NOT NULL DEFAULT 'OPEN',
    "payment_method" "PaymentMethod",
    "charged_folio_id" INTEGER,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "service_charge" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "waited_by_id" INTEGER NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "fb_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fb_order_item" (
    "id" SERIAL NOT NULL,
    "fb_order_id" INTEGER NOT NULL,
    "menu_item_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "notes" VARCHAR(255),

    CONSTRAINT "fb_order_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "housekeeping_log" (
    "id" SERIAL NOT NULL,
    "room_id" INTEGER NOT NULL,
    "old_status" "RoomStatus" NOT NULL,
    "new_status" "RoomStatus" NOT NULL,
    "note" TEXT,
    "updated_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "housekeeping_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "night_audit" (
    "id" SERIAL NOT NULL,
    "business_date" DATE NOT NULL,
    "run_by_id" INTEGER NOT NULL,
    "run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "NightAuditStatus" NOT NULL,
    "total_revenue" DECIMAL(14,2),
    "occupancy_rate" DECIMAL(5,2),
    "report_data" JSONB,

    CONSTRAINT "night_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" SERIAL NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" VARCHAR(100),
    "folio_id" INTEGER,
    "fb_order_id" INTEGER,
    "received_by_id" INTEGER NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "role_code_key" ON "role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "room_type_code_key" ON "room_type"("code");

-- CreateIndex
CREATE UNIQUE INDEX "room_number_key" ON "room"("number");

-- CreateIndex
CREATE UNIQUE INDEX "article_code_key" ON "article"("code");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_reservation_no_key" ON "reservation"("reservation_no");

-- CreateIndex
CREATE UNIQUE INDEX "folio_folio_no_key" ON "folio"("folio_no");

-- CreateIndex
CREATE UNIQUE INDEX "folio_reservation_id_key" ON "folio"("reservation_id");

-- CreateIndex
CREATE UNIQUE INDEX "menu_item_code_key" ON "menu_item"("code");

-- CreateIndex
CREATE UNIQUE INDEX "fb_order_order_no_key" ON "fb_order"("order_no");

-- CreateIndex
CREATE UNIQUE INDEX "night_audit_business_date_key" ON "night_audit"("business_date");

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room" ADD CONSTRAINT "room_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folio" ADD CONSTRAINT "folio_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folio_line_item" ADD CONSTRAINT "folio_line_item_folio_id_fkey" FOREIGN KEY ("folio_id") REFERENCES "folio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folio_line_item" ADD CONSTRAINT "folio_line_item_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folio_line_item" ADD CONSTRAINT "folio_line_item_fb_order_id_fkey" FOREIGN KEY ("fb_order_id") REFERENCES "fb_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folio_line_item" ADD CONSTRAINT "folio_line_item_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fb_order" ADD CONSTRAINT "fb_order_charged_folio_id_fkey" FOREIGN KEY ("charged_folio_id") REFERENCES "folio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fb_order" ADD CONSTRAINT "fb_order_waited_by_id_fkey" FOREIGN KEY ("waited_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fb_order_item" ADD CONSTRAINT "fb_order_item_fb_order_id_fkey" FOREIGN KEY ("fb_order_id") REFERENCES "fb_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fb_order_item" ADD CONSTRAINT "fb_order_item_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housekeeping_log" ADD CONSTRAINT "housekeeping_log_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housekeeping_log" ADD CONSTRAINT "housekeeping_log_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "night_audit" ADD CONSTRAINT "night_audit_run_by_id_fkey" FOREIGN KEY ("run_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_folio_id_fkey" FOREIGN KEY ("folio_id") REFERENCES "folio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_fb_order_id_fkey" FOREIGN KEY ("fb_order_id") REFERENCES "fb_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
