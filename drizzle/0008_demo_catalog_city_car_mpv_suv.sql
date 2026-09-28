-- Demo catalog seed: city cars, MPVs, and SUVs with one ACTIVE unit each.
-- Idempotent and non-destructive:
--   - Cars are upserted by deterministic UUID; rows created later from the
--     admin armada pages keep their richer values because the upsert uses
--     WHERE guards instead of overwriting every column.
--   - Units are only created for cars that do not have an ACTIVE unit yet.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

INSERT INTO "cars" (
  "id", "slug", "brand", "model", "category", "year",
  "transmission", "capacitySeats", "basePricePerDay",
  "isAvailable", "createdAt", "updatedAt"
)
SELECT
  id, slug, brand, model, category, year,
  transmission, capacity_seats, base_price_per_day,
  true, now(), now()
FROM (
  VALUES
    ('00000000-0000-4000-8000-000000000101'::uuid, 'honda-brio',            'Honda',      'Brio',          'passenger_car', 2024, 'Otomatis', 5,  350000),
    ('00000000-0000-4000-8000-000000000102'::uuid, 'toyota-agya',           'Toyota',     'Agya',          'passenger_car', 2024, 'Otomatis', 5,  325000),
    ('00000000-0000-4000-8000-000000000201'::uuid, 'toyota-avanza',         'Toyota',     'Avanza',        'mpv',           2024, 'Manual',   7,  450000),
    ('00000000-0000-4000-8000-000000000202'::uuid, 'mitsubishi-xpander',    'Mitsubishi', 'Xpander',       'mpv',           2024, 'Manual',   7,  550000),
    ('00000000-0000-4000-8000-000000000203'::uuid, 'toyota-innova-reborn',  'Toyota',     'Innova Reborn', 'mpv',           2024, 'Manual',   7,  750000),
    ('00000000-0000-4000-8000-000000000301'::uuid, 'toyota-rush',           'Toyota',     'Rush',          'suv',           2024, 'Manual',   7,  600000),
    ('00000000-0000-4000-8000-000000000302'::uuid, 'mitsubishi-pajero-sport','Mitsubishi','Pajero Sport',  'suv',           2024, 'Otomatis', 7, 1400000),
    ('00000000-0000-4000-8000-000000000303'::uuid, 'toyota-fortuner',       'Toyota',     'Fortuner',      'suv',           2024, 'Otomatis', 7, 1500000)
) AS demo(
  id, slug, brand, model, category, year,
  transmission, capacity_seats, base_price_per_day
)
WHERE NOT EXISTS (
  SELECT 1 FROM "cars" WHERE "cars"."id" = demo."id"
);

UPDATE "cars"
SET "isAvailable" = false, "updatedAt" = now()
WHERE "id" NOT IN (
  SELECT "carId" FROM "car_units" WHERE "status" = 'ACTIVE'
)
AND EXISTS (
  SELECT 1
  FROM (VALUES
    ('00000000-0000-4000-8000-000000000101'::uuid),
    ('00000000-0000-4000-8000-000000000102'::uuid),
    ('00000000-0000-4000-8000-000000000201'::uuid),
    ('00000000-0000-4000-8000-000000000202'::uuid),
    ('00000000-0000-4000-8000-000000000203'::uuid),
    ('00000000-0000-4000-8000-000000000301'::uuid),
    ('00000000-0000-4000-8000-000000000302'::uuid),
    ('00000000-0000-4000-8000-000000000303'::uuid)
  ) AS demo_ids(id)
  WHERE "cars"."id" = demo_ids.id
);

WITH demo_units ("carId", "plateNumber") AS (
  VALUES
    ('00000000-0000-4000-8000-000000000101'::uuid, 'XYZ-DEMO-BRIO'),
    ('00000000-0000-4000-8000-000000000102'::uuid, 'XYZ-DEMO-AGYA'),
    ('00000000-0000-4000-8000-000000000201'::uuid, 'XYZ-DEMO-AVANZA'),
    ('00000000-0000-4000-8000-000000000202'::uuid, 'XYZ-DEMO-XPANDER'),
    ('00000000-0000-4000-8000-000000000203'::uuid, 'XYZ-DEMO-INNOVA'),
    ('00000000-0000-4000-8000-000000000301'::uuid, 'XYZ-DEMO-RUSH'),
    ('00000000-0000-4000-8000-000000000302'::uuid, 'XYZ-DEMO-PAJERO'),
    ('00000000-0000-4000-8000-000000000303'::uuid, 'XYZ-DEMO-FORTUNER')
)
INSERT INTO "car_units" ("carId", "plateNumber", "status", "createdAt", "updatedAt")
SELECT "carId", "plateNumber", 'ACTIVE'::"car_unit_status", now(), now()
FROM demo_units
WHERE NOT EXISTS (
  SELECT 1
  FROM "car_units"
  WHERE "car_units"."carId" = demo_units."carId"
    AND "car_units"."status" = 'ACTIVE'
)
ON CONFLICT ("plateNumber") DO UPDATE SET
  "carId" = EXCLUDED."carId",
  "status" = 'ACTIVE',
  "updatedAt" = now();
