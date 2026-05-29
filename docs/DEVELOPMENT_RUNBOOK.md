# Development Runbook — Rental Mobil XYZ (Skripsi)

> Versi dokumen: Fase 10C.1
> Branch aktif: `refactor/dynamic-pricing-v4`

---

## 1. Prasyarat

| Komponen | Versi Minimum | Catatan |
|----------|--------------|---------|
| Node.js  | 20 LTS       | Diuji dengan v20.x |
| npm      | 10+          | Bundled dengan Node 20 |
| PostgreSQL | 15+        | Pastikan database berjalan sebelum web app |
| Python   | 3.12         | Untuk FastAPI ml-service |
| pip      | 23+          | Untuk install Python deps |
| Git      | 2.40+        | — |

### Model Artifact

File `ml-service/artifacts/v4_final/dynamic_pricing_adjustment_rf_pipeline_v4.pkl` (±340MB) harus ada di lokal. File ini **tidak ditrack Git** (besar). Pastikan sudah tersedia sebelum menjalankan ml-service.

---

## 2. Environment Variables

Buat file `.env` di root `web-app/` berdasarkan `.env.example`. Variabel yang diperlukan:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/rentalmobil

# Better Auth
BETTER_AUTH_SECRET=<random-string-32-chars>
BETTER_AUTH_URL=http://localhost:3000

# ML Service
ML_SERVICE_URL=http://localhost:8000

# Storage (untuk bukti pembayaran — local disk)
STORAGE_BASE_PATH=./storage
```

> **Jangan commit nilai secret aktual.** Gunakan `.env.example` sebagai template.

---

## 3. Setup Database

### 3.1 Jalankan Migrasi

```bash
# Di direktori web-app/
npm run db:migrate
```

6 migrasi akan dijalankan secara berurutan:
- `0001` — Dynamic Pricing v4 tables
- `0002` — Snapshot hardening
- `0003` — Better Auth foundation
- `0004` — Booking quote integrity & reservation expiry
- `0005` — Booking payments manual transfer
- `0006` — Timestamp integrity (timestamptz)

### 3.2 Seed Data (Opsional)

Tidak ada seed script otomatis. Tambahkan data mobil (`cars`) dan unit (`car_units`) langsung ke database menggunakan psql atau database client, atau melalui Drizzle Studio:

```bash
npm run db:studio
```

Pastikan minimal ada:
- Satu baris di tabel `cars` dengan `category` yang sesuai (misal: `MPV`, `SUV`, `Van`, `Premium`)
- Satu baris di tabel `car_units` yang merujuk ke `cars.id` dengan `status = 'ACTIVE'`
- Satu baris di tabel `pricing_model_versions` dengan `version = 'rf_adjustment_v4_final'` dan `isActive = true`

### 3.3 Seed Holiday (Opsional untuk Demo)

Tambahkan tanggal hari libur nasional ke tabel `holidays` untuk mengaktifkan fitur `is_holiday` pada pricing context.

---

## 4. Menjalankan FastAPI ml-service

```bash
# Di direktori web-app/ml-service/
# Aktifkan virtual environment
python -m venv .venv-v4           # Hanya pertama kali
.venv-v4\Scripts\activate         # Windows
# atau: source .venv-v4/bin/activate  (Linux/Mac)

# Install dependencies
pip install -r requirements-v4.txt

# Jalankan server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Server tersedia di `http://localhost:8000`. Pastikan ml-service berjalan sebelum menjalankan web app agar quote pricing berfungsi.

---

## 5. Menjalankan Next.js Web App

```bash
# Di direktori web-app/
npm install
npm run dev
```

Aplikasi tersedia di `http://localhost:3000`.

---

## 6. Flow Demo Customer

1. Buka `http://localhost:3000`
2. Klik **Katalog** → pilih mobil
3. Isi form **Dynamic Pricing Quote**: tanggal pickup, durasi, tipe trip
4. Klik **Hitung Harga** → sistem menghitung pricing v4 via FastAPI
5. Review invoice → klik **Konfirmasi Booking**
6. Login/register jika belum (Better Auth)
7. Di halaman konfirmasi, klik **Konfirmasi** → booking dibuat dengan price snapshot
8. Upload bukti pembayaran (file gambar/PDF)
9. Tunggu verifikasi admin

---

## 7. Flow Demo Admin

1. Buka `http://localhost:3000/login`
2. Login dengan akun yang memiliki `role = 'ADMIN'` di tabel `users`
3. Navigasi ke `/admin` → lihat dashboard ringkasan operasional
4. Navigasi ke `/admin/payments` → lihat antrean pembayaran
5. Klik detail pembayaran → Verify atau Reject

---

## 8. Catatan Teknis Penting

### Dynamic Pricing Model v4

- Model: Random Forest, memprediksi `price_adjustment_pct` (bukan harga langsung)
- Fitur input model: `vehicle_category`, `trip_type`, `duration_days`, `is_weekend`, `is_holiday`, `is_peak_season`, `utilization_rate`, `booking_lead_days`
- Pembulatan harga: ke kelipatan **Rp 1.000** (bukan Rp 50.000)
- Formula: `dynamicPriceDisplayPerDay = round(basePricePerDay * (1 + adj) / 1000) * 1000`

### Pricing Snapshot (Immutable)

Setelah customer mengkonfirmasi booking, harga disimpan ke tabel `booking_price_snapshots` dan **tidak dihitung ulang**. Tabel ini memiliki constraint `UNIQUE(bookingId)`.

### Reservation Expiry

Quote aktif selama **15 menit** (`pricingQuotes.expiresAt`). Booking yang dibuat dari quote yang kedaluwarsa akan ditolak.

### Payment Review Expiry

Setelah customer submit bukti pembayaran, admin memiliki window waktu untuk review (`bookingPayments.reviewExpiresAt`). Jika terlewat, pembayaran secara otomatis dianggap expired.

### Local Proof Storage

Bukti pembayaran disimpan di direktori lokal `storage/` (bukan cloud). Path relatif disimpan di `bookingPayments.proofStorageKey`.

### Lazy Expiry

Sistem menggunakan lazy expiry (memeriksa timestamp saat request). Tidak ada background job/cron yang secara aktif mengubah status expired.

### Batasan untuk Produksi

- Belum ada email notifikasi.
- Storage bukti pembayaran masih lokal (belum S3/cloud).
- Tidak ada background job untuk cleanup expired quotes.
- Admin stub pages (Armada, Supir, Transaksi, Laporan) masih hardcoded/mock.
- Tidak ada rate limiting.

---

## 9. Menjalankan Test Suite

```bash
# Di direktori web-app/
npm run test         # Unit + integration tests
npm run typecheck    # TypeScript type check
npm run lint         # ESLint
npm run build        # Production build check
```

> Beberapa integration test memerlukan koneksi PostgreSQL aktif (`DATABASE_URL` harus valid).

---

## 10. Troubleshooting Umum

| Masalah | Solusi |
|---------|--------|
| `DATABASE_URL` error saat test | Set env var sebelum npm run test |
| ML service 503 | Pastikan FastAPI berjalan di port 8000 |
| Quote tidak dihitung | Cek `pricing_model_versions` — harus ada baris dengan `isActive = true` |
| Upload bukti gagal | Pastikan direktori `storage/` ada dan writable |
| Better Auth error | Pastikan `BETTER_AUTH_SECRET` dan `BETTER_AUTH_URL` terisi |
