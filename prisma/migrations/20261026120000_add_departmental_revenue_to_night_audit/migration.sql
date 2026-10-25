-- AlterTable
ALTER TABLE "night_audit" ADD COLUMN "hk_revenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "misc_revenue" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- Backfill historical snapshots from daytime folio line items.
-- posted_at stores UTC as TIMESTAMP WITHOUT TIME ZONE; convert both Jakarta
-- midnight boundaries to the same type independently of the session time zone.
UPDATE "night_audit" na
SET
  "hk_revenue" = COALESCE(sub.hk, 0),
  "misc_revenue" = na."other_revenue" - COALESCE(sub.hk, 0)
FROM (
  SELECT
    na.id AS audit_id,
    COALESCE(SUM(fli.amount), 0) AS hk
  FROM "night_audit" na
  JOIN "folio_line_item" fli
    ON fli.posted_at >= (na.business_date::timestamp AT TIME ZONE 'Asia/Jakarta' AT TIME ZONE 'UTC')
   AND fli.posted_at < ((na.business_date + INTERVAL '1 day') AT TIME ZONE 'Asia/Jakarta' AT TIME ZONE 'UTC')
   AND fli.fb_order_id IS NULL
  JOIN "article" a ON a.id = fli.article_id
  WHERE a.type = 'SERVICE'
    AND a.code != 'ROOM-CHARGE'
  GROUP BY na.id
) sub
WHERE na.id = sub.audit_id;

-- Preserve other_revenue when no separate service lines are available.
UPDATE "night_audit"
SET "misc_revenue" = "other_revenue"
WHERE "hk_revenue" = 0 AND "misc_revenue" = 0 AND "other_revenue" != 0;
