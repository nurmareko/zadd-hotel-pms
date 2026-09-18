BEGIN;

SET LOCAL lock_timeout = '10s';
LOCK TABLE "lost_found_item" IN ACCESS EXCLUSIVE MODE;

-- Keep the applied backfill immutable. Preserve its sequence suffix exactly,
-- including values above 9999; only remove the first two year digits.
-- Check ALL proposed references so already-correct codes and century collisions
-- abort the transaction rather than overwrite or silently renumber any record.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM (
            SELECT CASE
                WHEN "reference_code" ~ '^LF-[0-9]{4}(0[1-9]|1[0-2])-[0-9]{4,}$'
                THEN 'LF-' || substring("reference_code" FROM 6)
                ELSE "reference_code"
            END AS proposed_reference
            FROM "lost_found_item"
        ) AS proposed
        GROUP BY proposed_reference
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Lost & Found YYMM reference collision; no references were changed';
    END IF;
END
$$;

UPDATE "lost_found_item"
SET "reference_code" = 'LF-' || substring("reference_code" FROM 6)
WHERE "reference_code" ~ '^LF-[0-9]{4}(0[1-9]|1[0-2])-[0-9]{4,}$';

COMMIT;
