-- AlterTable
ALTER TABLE "reservation"
  ADD COLUMN "signature_data_url" TEXT,
  ADD COLUMN "signed_at" TIMESTAMP(3);
