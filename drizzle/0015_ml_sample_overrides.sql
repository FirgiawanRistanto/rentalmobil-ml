-- Koreksi manual label (target price_adjustment_pct) untuk sampel live
-- continuous learning. Baris di tabel ini bersifat opsional: sampel tanpa
-- override dilabeli otomatis oleh aturan ahli v4 (app/labeler.py) saat retrain.

CREATE TABLE IF NOT EXISTS "ml_sample_overrides" (
  "quoteId" uuid PRIMARY KEY NOT NULL REFERENCES "pricing_quotes"("id") ON DELETE CASCADE,
  "targetAdjustmentPct" numeric(10,6) NOT NULL,
  "note" text,
  "updatedByUserId" uuid REFERENCES "users"("id"),
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ml_sample_overrides_updatedAt_idx" ON "ml_sample_overrides" ("updatedAt");

COMMENT ON TABLE "ml_sample_overrides" IS
  'Admin label overrides for live pricing samples used in continuous-learning retraining.';
