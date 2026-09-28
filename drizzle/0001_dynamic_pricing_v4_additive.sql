DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'car_unit_status') THEN
    CREATE TYPE "car_unit_status" AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trip_type') THEN
    CREATE TYPE "trip_type" AS ENUM ('DALAM_KOTA', 'LUAR_KOTA');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'demand_level') THEN
    CREATE TYPE "demand_level" AS ENUM ('sepi', 'normal', 'ramai');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pricing_quote_status') THEN
    CREATE TYPE "pricing_quote_status" AS ENUM ('ACTIVE', 'ACCEPTED', 'EXPIRED', 'INVALIDATED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "car_units" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "carId" uuid NOT NULL REFERENCES "cars"("id"),
  "plateNumber" text NOT NULL UNIQUE,
  "status" "car_unit_status" DEFAULT 'ACTIVE' NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pricing_quotes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "carId" uuid NOT NULL REFERENCES "cars"("id"),
  "userId" uuid REFERENCES "users"("id"),
  "pickupDate" timestamp NOT NULL,
  "returnDate" timestamp NOT NULL,
  "durationDays" integer NOT NULL,
  "tripType" "trip_type" NOT NULL,
  "basePricePerDay" integer NOT NULL,
  "categoryActiveUnits" integer NOT NULL,
  "categoryAvailableUnits" integer NOT NULL,
  "availabilityRatio" numeric(8, 4) NOT NULL,
  "utilizationRate" numeric(8, 4) NOT NULL,
  "demandLevel" "demand_level" NOT NULL,
  "isWeekend" boolean NOT NULL,
  "isHoliday" boolean NOT NULL,
  "isPeakSeason" boolean NOT NULL,
  "bookingLeadDays" integer NOT NULL,
  "predictedPriceAdjustmentPct" numeric(8, 4) NOT NULL,
  "dynamicPriceRawPerDay" integer NOT NULL,
  "dynamicPriceDisplayPerDay" integer NOT NULL,
  "totalInvoiceDisplay" integer NOT NULL,
  "pricingReasons" jsonb NOT NULL,
  "modelVersion" text NOT NULL,
  "status" "pricing_quote_status" DEFAULT 'ACTIVE' NOT NULL,
  "expiresAt" timestamp DEFAULT (now() + interval '15 minutes') NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "carUnitId" uuid REFERENCES "car_units"("id");
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "tripType" "trip_type" DEFAULT 'DALAM_KOTA' NOT NULL;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "phoneNumber" text;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "pickupAddress" text;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "pricingQuoteId" uuid REFERENCES "pricing_quotes"("id");
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "pricingSnapshotId" uuid;

CREATE TABLE IF NOT EXISTS "booking_price_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "bookingId" uuid NOT NULL UNIQUE REFERENCES "bookings"("id"),
  "pricingQuoteId" uuid REFERENCES "pricing_quotes"("id"),
  "basePricePerDay" integer NOT NULL,
  "categoryActiveUnits" integer NOT NULL,
  "categoryAvailableUnits" integer NOT NULL,
  "availabilityRatio" numeric(8, 4) NOT NULL,
  "utilizationRate" numeric(8, 4) NOT NULL,
  "demandLevel" "demand_level" NOT NULL,
  "predictedPriceAdjustmentPct" numeric(8, 4) NOT NULL,
  "dynamicPriceRawPerDay" integer NOT NULL,
  "dynamicPriceDisplayPerDay" integer NOT NULL,
  "totalInvoiceDisplay" integer NOT NULL,
  "pricingReasons" jsonb NOT NULL,
  "modelVersion" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_pricingSnapshotId_booking_price_snapshots_id_fk'
  ) THEN
    ALTER TABLE "bookings"
      ADD CONSTRAINT "bookings_pricingSnapshotId_booking_price_snapshots_id_fk"
      FOREIGN KEY ("pricingSnapshotId") REFERENCES "booking_price_snapshots"("id");
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "holidays" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "date" date NOT NULL UNIQUE,
  "name" text NOT NULL,
  "isActive" boolean DEFAULT true NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pricing_model_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "version" text NOT NULL UNIQUE,
  "targetName" text NOT NULL,
  "artifactPath" text NOT NULL,
  "metadata" jsonb,
  "trainedAt" timestamp,
  "isActive" boolean DEFAULT false NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

COMMENT ON TABLE "pricing_quotes" IS
  'Dynamic Pricing v4 quote. A quote does not reserve a car unit; it stores the price estimate shown to the customer, expires after a short window, and must be revalidated before final booking.';

COMMENT ON COLUMN "pricing_quotes"."expiresAt" IS
  'Default business rule for new quotes is 15 minutes from creation; expired or materially stale quotes must be replaced before final booking.';

COMMENT ON TABLE "booking_price_snapshots" IS
  'Immutable accepted pricing snapshot. Invoice, payment, customer dashboard, and admin views should read this snapshot instead of recalculating model output after booking creation.';

COMMENT ON COLUMN "cars"."isAvailable" IS
  'Legacy catalog-level availability flag. Dynamic Pricing v4 date-based availability must be calculated from ACTIVE car_units and active booking overlaps, not from this flag alone.';

INSERT INTO "holidays" ("date", "name", "isActive")
VALUES
  ('2026-01-01', 'Tahun Baru Masehi', true),
  ('2026-05-01', 'Hari Buruh Internasional', true),
  ('2026-08-17', 'Hari Kemerdekaan Republik Indonesia', true),
  ('2026-12-25', 'Hari Raya Natal', true)
ON CONFLICT ("date") DO UPDATE SET
  "name" = EXCLUDED."name",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = now();

INSERT INTO "pricing_model_versions" ("version", "targetName", "artifactPath", "metadata", "isActive")
VALUES (
  'rf_adjustment_v4_pending',
  'price_adjustment_pct',
  'ml-service/artifacts/v4_final/dynamic_pricing_adjustment_rf_pipeline_v4.pkl',
  '{"phase":"schema_seed","note":"Pending final Random Forest v4 artifact integration"}'::jsonb,
  false
)
ON CONFLICT ("version") DO UPDATE SET
  "targetName" = EXCLUDED."targetName",
  "artifactPath" = EXCLUDED."artifactPath",
  "metadata" = EXCLUDED."metadata",
  "isActive" = false,
  "updatedAt" = now();

INSERT INTO "car_units" ("carId", "plateNumber", "status")
SELECT
  c."id",
  concat('XYZ-', upper(substr(md5(c."id"::text || '-' || unit_no::text), 1, 7))) AS "plateNumber",
  'ACTIVE'::"car_unit_status"
FROM "cars" c
CROSS JOIN generate_series(1, 3) AS unit_no
WHERE c."isAvailable" = true
ORDER BY c."category", c."model", unit_no
ON CONFLICT ("plateNumber") DO NOTHING;
