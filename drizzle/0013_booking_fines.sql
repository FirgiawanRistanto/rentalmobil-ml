-- Late-return fines (per-day penalty assessed when admin completes a booking
-- after its endDate). The fine is charged like the extension invoice top-up:
-- the customer uploads a payment proof and the invoice totals only increase
-- after an admin VERIFIES it.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_fine_status') THEN
    CREATE TYPE "booking_fine_status" AS ENUM ('AWAITING_PAYMENT', 'SUBMITTED', 'VERIFIED', 'REJECTED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "booking_fines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "bookingId" uuid NOT NULL UNIQUE REFERENCES "bookings"("id"),
  "originalEndDate" timestamp NOT NULL,
  "actualReturnDate" timestamp NOT NULL,
  "lateDays" integer NOT NULL,
  "finePerDay" integer NOT NULL,
  "fineAmount" integer NOT NULL,
  "status" "booking_fine_status" DEFAULT 'AWAITING_PAYMENT' NOT NULL,
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

COMMENT ON TABLE "booking_fines" IS
  'Late-return fine assessed when an admin completes a booking after endDate; invoice totals apply only after admin verification.';
