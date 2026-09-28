-- Dynamic Pricing v4 manual bank transfer payment submissions.
-- Payment records reference immutable booking_price_snapshots for amount validation.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE "payment_method" AS ENUM ('BANK_TRANSFER_MANUAL');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE "payment_status" AS ENUM ('SUBMITTED', 'VERIFIED', 'REJECTED', 'EXPIRED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "booking_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "bookingId" uuid NOT NULL REFERENCES "bookings"("id"),
  "method" "payment_method" DEFAULT 'BANK_TRANSFER_MANUAL' NOT NULL,
  "status" "payment_status" DEFAULT 'SUBMITTED' NOT NULL,
  "amount" integer NOT NULL,
  "proofStorageKey" text NOT NULL,
  "proofOriginalName" text,
  "proofMimeType" text NOT NULL,
  "proofSizeBytes" integer NOT NULL,
  "submittedAt" timestamp NOT NULL,
  "reviewExpiresAt" timestamp NOT NULL,
  "reviewedAt" timestamp,
  "reviewedByUserId" uuid REFERENCES "users"("id"),
  "rejectionReason" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "booking_payments_booking_id_unique"
  ON "booking_payments" ("bookingId");

CREATE INDEX IF NOT EXISTS "booking_payments_status_idx"
  ON "booking_payments" ("status");

COMMENT ON TABLE "booking_payments" IS
  'Manual bank transfer payment proof submissions for Dynamic Pricing v4 bookings.';

COMMENT ON COLUMN "booking_payments"."amount" IS
  'Rupiah amount copied from booking_price_snapshots.totalInvoiceDisplay; never supplied by customer or admin.';

COMMENT ON COLUMN "booking_payments"."proofStorageKey" IS
  'Server-generated storage key for the uploaded proof. Do not expose absolute local filesystem paths to clients.';

COMMENT ON INDEX "booking_payments_booking_id_unique" IS
  'One payment submission per booking for the simple manual transfer flow. Rejected bookings are cancelled and require a new quote/booking.';
