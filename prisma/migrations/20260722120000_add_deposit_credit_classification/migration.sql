-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('DEPOSIT', 'PAYMENT', 'SETTLEMENT');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('PENDING', 'COLLECTED');

-- AlterTable
ALTER TABLE "payment" ADD COLUMN "purpose" "PaymentPurpose" NOT NULL DEFAULT 'PAYMENT';

-- AlterTable
ALTER TABLE "reservation" ADD COLUMN "deposit_status" "DepositStatus" NOT NULL DEFAULT 'PENDING';
