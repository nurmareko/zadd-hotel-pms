-- AlterTable
ALTER TABLE "reservation" ADD COLUMN "housekeeping_note" TEXT;

-- CreateTable
CREATE TABLE "reservation_add_on" (
  "id" SERIAL NOT NULL,
  "reservation_id" INTEGER NOT NULL,
  "label" VARCHAR(100) NOT NULL,
  "delivered" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "reservation_add_on_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "housekeeping_assignment" (
  "id" SERIAL NOT NULL,
  "room_id" INTEGER NOT NULL,
  "housekeeper_id" INTEGER NOT NULL,
  "date" DATE NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "housekeeping_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning_session" (
  "id" SERIAL NOT NULL,
  "room_id" INTEGER NOT NULL,
  "housekeeper_id" INTEGER NOT NULL,
  "date" DATE NOT NULL,
  "started_at" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),
  "inspected_at" TIMESTAMP(3),
  "inspected_by_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cleaning_session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "housekeeping_assignment_room_id_date_key" ON "housekeeping_assignment"("room_id", "date");

-- CreateIndex
CREATE INDEX "housekeeping_assignment_housekeeper_id_date_idx" ON "housekeeping_assignment"("housekeeper_id", "date");

-- CreateIndex
CREATE INDEX "housekeeping_assignment_date_idx" ON "housekeeping_assignment"("date");

-- CreateIndex
CREATE INDEX "cleaning_session_room_id_idx" ON "cleaning_session"("room_id");

-- CreateIndex
CREATE INDEX "cleaning_session_housekeeper_id_date_idx" ON "cleaning_session"("housekeeper_id", "date");

-- AddForeignKey
ALTER TABLE "reservation_add_on" ADD CONSTRAINT "reservation_add_on_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housekeeping_assignment" ADD CONSTRAINT "housekeeping_assignment_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housekeeping_assignment" ADD CONSTRAINT "housekeeping_assignment_housekeeper_id_fkey" FOREIGN KEY ("housekeeper_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning_session" ADD CONSTRAINT "cleaning_session_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning_session" ADD CONSTRAINT "cleaning_session_housekeeper_id_fkey" FOREIGN KEY ("housekeeper_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning_session" ADD CONSTRAINT "cleaning_session_inspected_by_id_fkey" FOREIGN KEY ("inspected_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
