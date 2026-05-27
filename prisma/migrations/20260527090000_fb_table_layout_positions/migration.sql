ALTER TABLE "restaurant_table"
ADD COLUMN "pos_x" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "pos_y" INTEGER NOT NULL DEFAULT 0;

WITH ordered_tables AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "number") - 1 AS table_index
  FROM "restaurant_table"
)
UPDATE "restaurant_table" AS table_to_update
SET
  "pos_x" = 20 + ((ordered_tables.table_index % 8) * 100),
  "pos_y" = 20 + ((ordered_tables.table_index / 8) * 100)
FROM ordered_tables
WHERE table_to_update."id" = ordered_tables."id";
