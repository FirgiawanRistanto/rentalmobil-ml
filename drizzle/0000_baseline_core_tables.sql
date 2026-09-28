-- Baseline schema for fresh databases (users, cars, bookings).
-- All statements are idempotent: existing databases created before this
-- migration runner existed are detected and left untouched.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role') THEN
    CREATE TYPE "role" AS ENUM ('CUSTOMER', 'ADMIN');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "emailVerified" boolean DEFAULT false NOT NULL,
  "emailVerifiedAt" timestamp,
  "image" text,
  "role" "role" DEFAULT 'CUSTOMER' NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
    CREATE TYPE "booking_status" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "cars" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "brand" text NOT NULL,
  "model" text NOT NULL,
  "category" text NOT NULL,
  "year" integer NOT NULL,
  "transmission" text DEFAULT 'Manual' NOT NULL,
  "capacitySeats" integer DEFAULT 7 NOT NULL,
  "basePricePerDay" integer NOT NULL,
  "isAvailable" boolean DEFAULT true NOT NULL,
  "imageUrl" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF to_regclass('public.bookings') IS NULL THEN
    EXECUTE 'CREATE TABLE "bookings" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "userId" uuid NOT NULL REFERENCES "users"("id"),
      "carId" uuid NOT NULL REFERENCES "cars"("id"),
      "startDate" timestamp NOT NULL,
      "endDate" timestamp NOT NULL,
      "totalPrice" integer NOT NULL,
      "status" "booking_status" DEFAULT ''PENDING'' NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    )';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "bookings_userId_idx" ON "bookings" ("userId");
CREATE INDEX IF NOT EXISTS "bookings_carId_idx" ON "bookings" ("carId");
