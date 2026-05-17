-- Drop captured-but-unused HK person count fields.
ALTER TABLE "housekeeping_log"
DROP COLUMN "reported_adult_count",
DROP COLUMN "reported_child_count";
