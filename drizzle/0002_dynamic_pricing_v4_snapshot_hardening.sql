-- Dynamic Pricing v4 hardening:
-- booking_price_snapshots.bookingId is the canonical one-to-one snapshot relation.
-- bookings.pricingSnapshotId was introduced during the additive schema pass but creates
-- an unnecessary circular/redundant relation, so it is removed safely here.

DO $$
DECLARE
  snapshot_constraint record;
BEGIN
  FOR snapshot_constraint IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY (con.conkey)
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'bookings'
      AND att.attname = 'pricingSnapshotId'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
      'public',
      'bookings',
      snapshot_constraint.conname
    );
  END LOOP;
END $$;

ALTER TABLE "bookings" DROP COLUMN IF EXISTS "pricingSnapshotId";

ALTER TABLE "pricing_quotes"
  ALTER COLUMN "predictedPriceAdjustmentPct" TYPE numeric(10, 6)
  USING "predictedPriceAdjustmentPct"::numeric(10, 6);

ALTER TABLE "booking_price_snapshots"
  ALTER COLUMN "predictedPriceAdjustmentPct" TYPE numeric(10, 6)
  USING "predictedPriceAdjustmentPct"::numeric(10, 6);

COMMENT ON TABLE "booking_price_snapshots" IS
  'Immutable accepted pricing snapshot. Exactly one snapshot is linked to each booking through UNIQUE bookingId; invoice, payment, customer dashboard, and admin views should read this row instead of recalculating model output.';

COMMENT ON COLUMN "booking_price_snapshots"."bookingId" IS
  'Canonical one-to-one relation from booking to its accepted pricing snapshot.';

COMMENT ON COLUMN "pricing_quotes"."predictedPriceAdjustmentPct" IS
  'Decimal adjustment predicted by Dynamic Pricing v4; for example 0.218500 means +21.85%.';

COMMENT ON COLUMN "booking_price_snapshots"."predictedPriceAdjustmentPct" IS
  'Decimal adjustment accepted by the customer and frozen in the booking snapshot; for example -0.120000 means -12.00%.';

-- Technical note: development seed data for holidays, pricing model version, and
-- car_units currently lives in 0001_dynamic_pricing_v4_additive.sql because it was
-- needed immediately after the additive schema pass. During database polish, replicate
-- or move that development seed into a dedicated seed script so future migrations stay
-- structural and production data policy remains explicit.
