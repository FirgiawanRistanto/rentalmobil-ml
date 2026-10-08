-- Denda keterlambatan sekarang dibebankan ke invoice sejak baris denda dibuat
-- (saat admin menyelesaikan booking setelah endDate), bukan menunggu verifikasi
-- admin. Verifikasi admin hanya mengonfirmasi pembayarannya, dan pembatalan
-- admin mengembalikan nominal denda dari tagihan booking.
--
-- Kolom "invoiceAppliedAt" mencatat kapan nominal denda benar-benar masuk
-- invoice (NULL = sedang tidak masuk tagihan), sehingga penambahan tidak bisa
-- terjadi dua kali dan pengembalian bisa dihitung tepat.

ALTER TABLE "booking_fines"
  ADD COLUMN IF NOT EXISTS "invoiceAppliedAt" timestamp;

-- Backfill baris lama: denda yang sudah VERIFIED sudah masuk invoice sebelum
-- kolom ini ada, jadi tandai supaya verifikasi berikutnya tidak menambah lagi.
UPDATE "booking_fines"
SET "invoiceAppliedAt" = COALESCE("reviewedAt", "createdAt")
WHERE "status" = 'VERIFIED'
  AND "invoiceAppliedAt" IS NULL;

COMMENT ON COLUMN "booking_fines"."invoiceAppliedAt" IS
  'Waktu nominal denda dibebankan ke invoice booking; NULL berarti denda tidak (lagi) masuk tagihan.';

COMMENT ON TABLE "booking_fines" IS
  'Late-return fine assessed when an admin completes a booking after endDate; the amount is billed immediately and an admin cancellation returns the invoice.';
