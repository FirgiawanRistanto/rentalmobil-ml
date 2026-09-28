-- Catalog schema fields for the admin armada pages (slug, transmission, seats).
-- Idempotent: safe to run on databases that already applied these fields manually.

ALTER TABLE "cars" ADD COLUMN IF NOT EXISTS "slug" text;
ALTER TABLE "cars" ADD COLUMN IF NOT EXISTS "transmission" text;
ALTER TABLE "cars" ADD COLUMN IF NOT EXISTS "capacitySeats" integer;

-- Backfill slug for any pre-existing catalog rows before the NOT NULL constraint.
UPDATE "cars"
SET
  "slug" = lower(regexp_replace(
    trim(concat_ws('-', "brand", "model", left("id"::text, 8))),
    '[^a-zA-Z0-9]+',
    '-',
    'g'
  ))
WHERE "slug" IS NULL OR trim("slug") = '';

UPDATE "cars"
SET
  "transmission" = coalesce(nullif(trim("transmission"), ''), 'Manual'),
  "capacitySeats" = coalesce("capacitySeats", 7);

ALTER TABLE "cars" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "cars" ALTER COLUMN "transmission" SET DEFAULT 'Manual';
ALTER TABLE "cars" ALTER COLUMN "transmission" SET NOT NULL;
ALTER TABLE "cars" ALTER COLUMN "capacitySeats" SET DEFAULT 7;
ALTER TABLE "cars" ALTER COLUMN "capacitySeats" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "cars_slug_unique" ON "cars" ("slug");
