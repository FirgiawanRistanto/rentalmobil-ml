-- Rename placeholder demo plates (XYZ-DEMO-*) to realistic Indonesian plates
-- for databases created before migration 0008 was updated. Idempotent:
-- only rows still using the placeholder format are renamed, and the update
-- is skipped per-row when the target plate is already taken by another unit.

WITH renames ("oldPlate", "newPlate") AS (
  VALUES
    ('XYZ-DEMO-BRIO',     'B 2873 KPZ'),
    ('XYZ-DEMO-AGYA',     'B 1925 KQA'),
    ('XYZ-DEMO-AVANZA',   'B 1745 TQA'),
    ('XYZ-DEMO-XPANDER',  'B 2183 TQB'),
    ('XYZ-DEMO-INNOVA',   'B 2854 TQC'),
    ('XYZ-DEMO-RUSH',     'B 2547 TZA'),
    ('XYZ-DEMO-PAJERO',   'B 2432 TDA'),
    ('XYZ-DEMO-FORTUNER', 'B 2848 TDB')
)
UPDATE "car_units" AS target
SET "plateNumber" = renames."newPlate",
    "updatedAt" = now()
FROM renames
WHERE target."plateNumber" = renames."oldPlate"
  AND NOT EXISTS (
    SELECT 1
    FROM "car_units" AS other
    WHERE other."plateNumber" = renames."newPlate"
      AND other."id" <> target."id"
  );
