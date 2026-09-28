-- Dynamic Pricing v4 booking hardening:
-- 1. one accepted pricing quote may create at most one booking;
-- 2. PENDING v4 bookings reserve a unit only until reservationExpiresAt.

ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "reservationExpiresAt" timestamp;

CREATE UNIQUE INDEX IF NOT EXISTS "bookings_pricing_quote_id_unique_non_null"
  ON "bookings" ("pricingQuoteId")
  WHERE "pricingQuoteId" IS NOT NULL;

COMMENT ON COLUMN "bookings"."reservationExpiresAt" IS
  'Dynamic Pricing v4 reservation hold expiry for PENDING bookings. NULL is allowed for legacy rows; legacy PENDING rows with NULL expiry are treated as blocking until reconciled.';

COMMENT ON INDEX "bookings_pricing_quote_id_unique_non_null" IS
  'Ensures one non-null pricing quote can create at most one booking while preserving legacy bookings with NULL pricingQuoteId.';
