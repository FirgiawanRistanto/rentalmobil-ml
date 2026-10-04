-- Configurable pricing settings (key/value). Row 'lateFineDailyRatePct'
-- mengontrol persentase tarif harian tersnap yang dikenakan sebagai denda
-- keterlambatan per hari (default 100 = setara satu hari sewa tambahan).
-- Admin mengubahnya lewat halaman Pengaturan; hanya mempengaruhi denda baru.

CREATE TABLE IF NOT EXISTS "pricing_settings" (
  "key" text PRIMARY KEY NOT NULL,
  "value" integer NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "updatedByUserId" uuid REFERENCES "users"("id")
);

INSERT INTO "pricing_settings" ("key", "value")
VALUES ('lateFineDailyRatePct', 100)
ON CONFLICT ("key") DO NOTHING;

COMMENT ON TABLE "pricing_settings" IS
  'Key/value pricing configuration managed by admin (e.g. late-return fine daily rate percent).';
