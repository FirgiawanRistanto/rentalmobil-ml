-- Timestamp integrity hardening for Dynamic Pricing v4 operational deadlines.
-- Existing deadline values written by the application were stored as UTC-naive
-- timestamp values. Interpret those legacy values as UTC instants during the
-- conversion to timestamptz.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'pricing_quotes'
      AND column_name = 'expiresAt'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE "pricing_quotes"
      ALTER COLUMN "expiresAt" TYPE timestamptz
      USING "expiresAt" AT TIME ZONE 'UTC';
  END IF;
END $$;

ALTER TABLE "pricing_quotes"
  ALTER COLUMN "expiresAt" SET DEFAULT (now() + interval '15 minutes');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'pricing_quotes'
      AND column_name = 'createdAt'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE "pricing_quotes"
      ALTER COLUMN "createdAt" TYPE timestamptz
      USING "createdAt" AT TIME ZONE 'UTC';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'pricing_quotes'
      AND column_name = 'updatedAt'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE "pricing_quotes"
      ALTER COLUMN "updatedAt" TYPE timestamptz
      USING "updatedAt" AT TIME ZONE 'UTC';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'bookings'
      AND column_name = 'reservationExpiresAt'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE "bookings"
      ALTER COLUMN "reservationExpiresAt" TYPE timestamptz
      USING "reservationExpiresAt" AT TIME ZONE 'UTC';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'bookings'
      AND column_name = 'createdAt'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE "bookings"
      ALTER COLUMN "createdAt" TYPE timestamptz
      USING "createdAt" AT TIME ZONE 'UTC';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'bookings'
      AND column_name = 'updatedAt'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE "bookings"
      ALTER COLUMN "updatedAt" TYPE timestamptz
      USING "updatedAt" AT TIME ZONE 'UTC';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'booking_payments'
      AND column_name = 'submittedAt'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE "booking_payments"
      ALTER COLUMN "submittedAt" TYPE timestamptz
      USING "submittedAt" AT TIME ZONE 'UTC';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'booking_payments'
      AND column_name = 'reviewExpiresAt'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE "booking_payments"
      ALTER COLUMN "reviewExpiresAt" TYPE timestamptz
      USING "reviewExpiresAt" AT TIME ZONE 'UTC';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'booking_payments'
      AND column_name = 'reviewedAt'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE "booking_payments"
      ALTER COLUMN "reviewedAt" TYPE timestamptz
      USING "reviewedAt" AT TIME ZONE 'UTC';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'booking_payments'
      AND column_name = 'createdAt'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE "booking_payments"
      ALTER COLUMN "createdAt" TYPE timestamptz
      USING "createdAt" AT TIME ZONE 'UTC';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'booking_payments'
      AND column_name = 'updatedAt'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE "booking_payments"
      ALTER COLUMN "updatedAt" TYPE timestamptz
      USING "updatedAt" AT TIME ZONE 'UTC';
  END IF;
END $$;

COMMENT ON COLUMN "pricing_quotes"."expiresAt" IS
  'Absolute expiration instant for Dynamic Pricing v4 quotes; stored as timestamptz.';

COMMENT ON COLUMN "pricing_quotes"."createdAt" IS
  'Absolute creation instant for Dynamic Pricing v4 quote audit data; stored as timestamptz.';

COMMENT ON COLUMN "pricing_quotes"."updatedAt" IS
  'Absolute update instant for Dynamic Pricing v4 quote audit data; stored as timestamptz.';

COMMENT ON COLUMN "bookings"."reservationExpiresAt" IS
  'Absolute reservation hold expiration instant for PENDING bookings. NULL is allowed for legacy rows; legacy PENDING rows with NULL expiry are treated as blocking until reconciled.';

COMMENT ON COLUMN "bookings"."createdAt" IS
  'Absolute creation instant for booking reservation audit data; stored as timestamptz.';

COMMENT ON COLUMN "bookings"."updatedAt" IS
  'Absolute update instant for booking reservation audit data; stored as timestamptz.';

COMMENT ON COLUMN "booking_payments"."submittedAt" IS
  'Absolute instant when a manual transfer proof was submitted.';

COMMENT ON COLUMN "booking_payments"."reviewExpiresAt" IS
  'Absolute instant when the admin review window expires.';

COMMENT ON COLUMN "booking_payments"."reviewedAt" IS
  'Absolute instant when the manual transfer proof was verified, rejected, or expired.';

COMMENT ON COLUMN "booking_payments"."createdAt" IS
  'Absolute audit instant for manual payment rows; stored as timestamptz to match payment deadline fields.';

COMMENT ON COLUMN "booking_payments"."updatedAt" IS
  'Absolute audit instant for manual payment row updates; stored as timestamptz to match payment deadline fields.';
