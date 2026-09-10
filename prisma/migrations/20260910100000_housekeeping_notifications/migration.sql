-- CreateEnum
CREATE TYPE "HousekeepingNotificationStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "housekeeping_notification" (
    "id" SERIAL NOT NULL,
    "assignment_id" INTEGER NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "status" "HousekeepingNotificationStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "housekeeping_notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "housekeeping_notification_assignment_id_recipient_id_status_key" ON "housekeeping_notification"("assignment_id", "recipient_id", "status");

-- CreateIndex
CREATE INDEX "housekeeping_notification_recipient_id_read_at_idx" ON "housekeeping_notification"("recipient_id", "read_at");

-- CreateIndex
CREATE INDEX "housekeeping_notification_assignment_id_idx" ON "housekeeping_notification"("assignment_id");

-- AddForeignKey
ALTER TABLE "housekeeping_notification" ADD CONSTRAINT "housekeeping_notification_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "housekeeping_assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housekeeping_notification" ADD CONSTRAINT "housekeeping_notification_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;