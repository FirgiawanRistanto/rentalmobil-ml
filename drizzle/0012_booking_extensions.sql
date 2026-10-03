-- Customer rental duration extensions (invoice-top-up flow).
-- Booking endDate/totals are only updated after an admin VERIFIES the
-- supplemental payment proof for the price difference of the extra days.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_extension_status') THEN
    CREATE TYPE "booking_extension_status" AS ENUM ('AWAITING_PAYMENT', 'SUBMITTED', 'VERIFIED', 'REJECTED', 'CANCELLED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "booking_extensions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "bookingId" uuid NOT NULL REFERENCES "bookings"("id"),
  "previousEndDate" timestamp NOT NULL,
  "newEndDate" timestamp NOT NULL,
  "extraDays" integer NOT NULL,
  "extraAmount" integer NOT NULL,
  "dynamicPriceDisplayPerDay" integer NOT NULL,
  "pricingReasons" jsonb NOT NULL,
  "modelVersion" text NOT NULL,
  "status" "booking_extension_status" DEFAULT 'AWAITING_PAYMENT' NOT NULL,
  "proofStorageKey" text,
  "proofOriginalName" text,
  "proofMimeType" text,
  "proofSizeBytes" integer,
  "submittedAt" timestamp,
  "rejectionReason" text,
  "reviewedAt" timestamp,
  "reviewedByUserId" uuid REFERENCES "users"("id"),
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "booking_extensions_booking_id_idx"
  ON "booking_extensions" ("bookingId");

COMMENT ON TABLE "booking_extensions" IS
  'Customer rental duration extension requests; booking dates/totals apply only after admin verification.';
