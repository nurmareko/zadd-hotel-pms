CREATE TYPE "FBOrderServiceType" AS ENUM ('DINE_IN', 'ROOM_SERVICE');

ALTER TABLE "fb_order"
ADD COLUMN "service_type" "FBOrderServiceType" NOT NULL DEFAULT 'DINE_IN';
