-- Enforce polymorphic payment ownership:
-- folio payments settle guest folios, while F&B-direct payments close FB orders.
ALTER TABLE "payment"
ADD CONSTRAINT "payment_exactly_one_owner_check"
CHECK (
  ("folio_id" IS NOT NULL AND "fb_order_id" IS NULL)
  OR
  ("folio_id" IS NULL AND "fb_order_id" IS NOT NULL)
);
