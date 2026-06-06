UPDATE "reservation"
SET "notes" = CASE
  WHEN NULLIF(BTRIM("notes"), '') IS NULL THEN NULLIF(BTRIM("comment"), '')
  WHEN POSITION(NULLIF(BTRIM("comment"), '') IN "notes") > 0 THEN "notes"
  ELSE "notes" || E'\n' || NULLIF(BTRIM("comment"), '')
END
WHERE NULLIF(BTRIM("comment"), '') IS NOT NULL;

DROP TABLE IF EXISTS "reservation_add_on";

ALTER TABLE "reservation"
  DROP COLUMN "comment",
  DROP COLUMN "housekeeping_note";
