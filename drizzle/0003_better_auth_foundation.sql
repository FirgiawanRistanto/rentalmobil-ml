-- Better Auth foundation for Dynamic Pricing v4 booking/auth phases.
-- This migration preserves the existing users table and bookings.userId relation.

DO $$
DECLARE
  email_verified_type text;
BEGIN
  SELECT data_type
  INTO email_verified_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'emailVerified';

  IF email_verified_type IS NULL THEN
    ALTER TABLE "users"
      ADD COLUMN "emailVerified" boolean DEFAULT false NOT NULL;
  ELSIF email_verified_type <> 'boolean' THEN
    ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "emailVerifiedAt" timestamp;

    IF email_verified_type LIKE 'timestamp%' THEN
      EXECUTE 'UPDATE "users"
        SET "emailVerifiedAt" = "emailVerified"
        WHERE "emailVerified" IS NOT NULL
          AND "emailVerifiedAt" IS NULL';

      EXECUTE 'ALTER TABLE "users"
        ALTER COLUMN "emailVerified" TYPE boolean
        USING ("emailVerified" IS NOT NULL)';
    ELSE
      EXECUTE 'ALTER TABLE "users"
        ALTER COLUMN "emailVerified" TYPE boolean
        USING COALESCE("emailVerified"::text::boolean, false)';
    END IF;
  END IF;

  ALTER TABLE "users"
    ALTER COLUMN "emailVerified" SET DEFAULT false;

  UPDATE "users"
    SET "emailVerified" = false
    WHERE "emailVerified" IS NULL;

  ALTER TABLE "users"
    ALTER COLUMN "emailVerified" SET NOT NULL;
END $$;

CREATE TABLE IF NOT EXISTS "accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamp,
  "refreshTokenExpiresAt" timestamp,
  "scope" text,
  "password" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "accounts_userId_idx"
  ON "accounts" ("userId");

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "token" text NOT NULL UNIQUE,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "sessions_userId_idx"
  ON "sessions" ("userId");

CREATE TABLE IF NOT EXISTS "verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "verifications_identifier_idx"
  ON "verifications" ("identifier");

COMMENT ON COLUMN "users"."emailVerified" IS
  'Better Auth boolean email verification flag. Legacy timestamp values are preserved in emailVerifiedAt.';

COMMENT ON COLUMN "users"."emailVerifiedAt" IS
  'Legacy timestamp preserved from the original schema before Better Auth required a boolean emailVerified field.';

COMMENT ON TABLE "accounts" IS
  'Better Auth account credentials/providers table mapped to existing users.id.';

COMMENT ON TABLE "sessions" IS
  'Better Auth session table mapped to existing users.id.';

COMMENT ON TABLE "verifications" IS
  'Better Auth verification token table.';
