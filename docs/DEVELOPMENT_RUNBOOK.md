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

### 3.1 Setup Database (Migrasi + Seed)

```bash
# Di direktori web-app/
npm run setup
```

Perintah ini menjalankan migrasi, seed konfigurasi pricing, dan verifikasi state secara berurutan — dengan ringkasan ✔/✘ dan diagnosis koneksi (ECONNREFUSED, kredensial salah, dsb) bila gagal. Aman dijalankan ulang. Untuk tahap manual per-komponen tetap tersedia: `npm run db:migrate`, `npm run db:seed`, `npm run verify:setup`.

10 migrasi akan dijalankan secara berurutan:
- `0000` — Baseline core tables (users, cars, bookings) untuk database baru
- `0001` — Dynamic Pricing v4 tables
- `0002` — Snapshot hardening
- `0003` — Better Auth foundation
- `0004` — Booking quote integrity & reservation expiry
- `0005` — Booking payments manual transfer
- `0006` — Timestamp integrity (timestamptz)
- `0007` — Admin armada catalog fields (slug, transmission, capacitySeats)
- `0008` — Demo catalog seed (8 mobil + unit aktif)
- `0009` — Booking status `EXPIRED`

### 3.2 Seed Data

Migrasi `0008` otomatis menanamkan data demo: 8 mobil (city car, MPV, SUV) masing-masing dengan satu unit `ACTIVE`. Seed ini idempotent — menjalankan `db:migrate` ulang tidak menduplikasi data maupun menimpa perubahan yang sudah dibuat dari halaman admin.

Tambahkan data tambahan melalui Drizzle Studio atau psql:

```bash
npm run db:studio
```

Selanjutnya jalankan seed konfigurasi:

```bash
npm run db:seed
```

Seed idempotent ini menyiapkan:
- `pricing_model_versions` — baris `rf_adjustment_v4_final` beserta metadata & path artefak; diaktifkan hanya jika belum ada model aktif lain (pilihan admin tidak ditimpa)
- `holidays` — 17 hari libur nasional 2026; tanggal yang sudah ada tidak diubah. Data ini yang mengaktifkan fitur `is_holiday` pada pricing context; tambahan/libur lain bisa dimasukkan manual via `npm run db:studio`
- Akun admin (opsional) — jika `ADMIN_EMAIL` + `ADMIN_PASSWORD` diset di `.env`: user di-upsert sebagai `role='ADMIN'` dengan credential password yang di-hash via `better-auth/crypto` (format identik dengan sign-in). Mengganti `ADMIN_PASSWORD` lalu seed ulang akan merotasi password; tanpa kedua env var itu bagian ini dilewati. Password tidak pernah dicetak ke output

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
2. Login dengan akun yang memiliki `role = 'ADMIN'` di tabel `users`.
   Paling mudah: set `ADMIN_EMAIL` + `ADMIN_PASSWORD` di `.env` lalu jalankan `npm run db:seed` (lihat bagian 3.2). Alternatif manual: registrasi dulu lewat `/register`, lalu promosikan:
   ```bash
   psql -U postgres -d rentalmobil -c "UPDATE \"users\" SET \"role\" = 'ADMIN' WHERE email = 'email-kamu@example.com';"
   ```
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
npm run verify:setup # Cek hasil db:migrate + db:seed terhadap database aktif
```

CI menjalankan job **DB Migrate + Seed** (`.github/workflows/ci.yml`) dengan PostgreSQL 15 throwaway: `npm run setup` dijalankan **dua kali** — run kedua adalah bukti idempotensi — memverifikasi 12 tabel, 17 holiday, dan model aktif, sehingga regresi setup tertangkap otomatis di PR/push. Jika daftar seed berubah, sinkronkan `EXPECTED_HOLIDAY_COUNT` di `scripts/verify-setup.mjs`.

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
