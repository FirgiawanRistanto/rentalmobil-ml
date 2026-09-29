-- Expand the demo fleet to 2-3 ACTIVE units per demo car (20 units total).
-- For databases created before 0008 was expanded, this adds the missing
-- units. For fresh databases this is a no-op because 0008 already inserted
-- every plate below. Idempotent: existing plates are never modified.

WITH demo_units ("carId", "plateNumber") AS (
  VALUES
    ('00000000-0000-4000-8000-000000000101'::uuid, 'B 2873 KPZ'),
    ('00000000-0000-4000-8000-000000000101'::uuid, 'B 2401 KPZ'),
    ('00000000-0000-4000-8000-000000000101'::uuid, 'B 1967 KPZ'),
    ('00000000-0000-4000-8000-000000000102'::uuid, 'B 1925 KQA'),
    ('00000000-0000-4000-8000-000000000102'::uuid, 'B 1487 KQB'),
    ('00000000-0000-4000-8000-000000000201'::uuid, 'B 1745 TQA'),
    ('00000000-0000-4000-8000-000000000201'::uuid, 'B 1361 TQB'),
    ('00000000-0000-4000-8000-000000000201'::uuid, 'B 2039 TQC'),
    ('00000000-0000-4000-8000-000000000202'::uuid, 'B 2183 TQB'),
    ('00000000-0000-4000-8000-000000000202'::uuid, 'B 1584 TQC'),
    ('00000000-0000-4000-8000-000000000202'::uuid, 'B 1126 TQD'),
    ('00000000-0000-4000-8000-000000000203'::uuid, 'B 2854 TQC'),
    ('00000000-0000-4000-8000-000000000203'::uuid, 'B 2259 TQD'),
    ('00000000-0000-4000-8000-000000000301'::uuid, 'B 2547 TZA'),
    ('00000000-0000-4000-8000-000000000301'::uuid, 'B 2011 TZB'),
    ('00000000-0000-4000-8000-000000000302'::uuid, 'B 2432 TDA'),
    ('00000000-0000-4000-8000-000000000302'::uuid, 'B 1976 TDB'),
    ('00000000-0000-4000-8000-000000000303'::uuid, 'B 2848 TDB'),
    ('00000000-0000-4000-8000-000000000303'::uuid, 'B 2306 TDC'),
    ('00000000-0000-4000-8000-000000000303'::uuid, 'B 1749 TDD')
)
INSERT INTO "car_units" ("carId", "plateNumber", "status", "createdAt", "updatedAt")
SELECT "carId", "plateNumber", 'ACTIVE'::"car_unit_status", now(), now()
FROM demo_units
WHERE NOT EXISTS (
  SELECT 1
  FROM "car_units"
  WHERE "car_units"."plateNumber" = demo_units."plateNumber"
)
ON CONFLICT ("plateNumber") DO NOTHING;
