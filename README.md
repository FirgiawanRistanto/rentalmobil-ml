# Rental Mobil XYZ — Sistem Informasi dengan Dynamic Pricing (Random Forest)

Sistem Informasi Rental Mobil XYZ adalah aplikasi web untuk manajemen rental mobil yang mengimplementasikan algoritma **Random Forest** untuk rekomendasi *dynamic pricing*. Model memprediksi persentase penyesuaian harga (`price_adjustment_pct`) berdasarkan kondisi penyewaan dan tingkat utilisasi armada, kemudian harga ditampilkan sebagai invoice dengan snapshot yang bersifat immutable.

> **Catatan akademik:** Rental Mobil XYZ merupakan objek simulasi untuk keperluan skripsi. Dataset machine learning berasal dari dataset sekunder Kaggle yang telah melalui adaptasi dan perluasan transaksi simulasi. Model tidak diklaim memprediksi harga pasar nyata secara optimal.

## ✨ Fitur

- **Katalog & Detail Mobil** — daftar armada dengan filter dan pencarian
- **Dynamic Pricing v4** — quote harga real-time berdasarkan utilisasi armada, weekend, hari libur, musim puncak, tipe trip, durasi, dan lead time booking
- **Invoice Preview & Pricing Snapshot** — harga yang disetujui customer disimpan permanen dan tidak dihitung ulang diam-diam
- **Booking & Pembayaran** — booking dari quote, upload bukti transfer manual, verifikasi admin
- **Dashboard Admin** — kelola mobil & unit, antrean pembayaran, transaksi, laporan (termasuk rekap konversi quote), serta visualisasi model Random Forest (feature importance, pohon keputusan)
- **Continuous Learning** — retrain model Random Forest dari data live dengan guardrail metrik, aktivasi/rollback versi model, dan ambang retrain yang bisa dikonfigurasi admin dari halaman Pengaturan
- **Pengaturan Pricing** — tarif denda keterlambatan serta ambang guardrail/kelayakan retrain disimpan dinamis di tabel `pricing_settings`
- **Authentication** — registrasi, login, dan session menggunakan Better Auth

## 🛠 Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Web App | Next.js (App Router), React, TypeScript, Tailwind CSS |
| Database | PostgreSQL + Drizzle ORM |
| Authentication | Better Auth |
| ML Service | Python, FastAPI, scikit-learn |
| Model | Random Forest Regressor (target: `price_adjustment_pct`) |

## 📁 Struktur Project

```
.
├── src/                   # Kode aplikasi Next.js
│   ├── app/               # Halaman (customer, admin, booking) & API routes
│   ├── components/        # Komponen UI
│   ├── db/                # Drizzle schema, seed, integrity tests
│   ├── domain/            # Pricing context service
│   ├── lib/               # Auth, helper, UI rules
│   └── services/          # Service layer (booking, payment, admin, dll)
├── drizzle/               # File migrasi database (+ meta/_journal.json)
├── ml-service/            # FastAPI inference service
│   ├── app/               # Schemas, model loader, pricing post-processing
│   ├── artifacts/         # Metadata & artefak model (file .pkl tidak ditrack Git)
│   └── tests/             # Test pytest inference contract v4
├── scripts/               # Setup database & verifikasi setup
├── docs/                  # Runbook, skenario test, artefak evaluasi model
├── storage/               # Penyimpanan lokal bukti pembayaran
└── .github/workflows/     # CI (Web App + DB Migrate & Seed)
```

## 📋 Prasyarat

| Komponen | Versi Minimum |
|----------|---------------|
| Node.js | 20 LTS |
| npm | 10+ |
| PostgreSQL | 15+ |
| Python | 3.12 |

## ⚙️ Instalasi

### 1. Environment Variables

Buat file `.env` di root repo berdasarkan `.env.example`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rentalmobil
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=replace-with-secure-secret
ML_SERVICE_BASE_URL=http://127.0.0.1:8000

# Opsional: origin tambahan untuk Better Auth (dipisah koma).
# Origin localhost port berapa pun otomatis dipercaya saat development.
AUTH_TRUSTED_ORIGINS=

# Opsional: jika keduanya diset, `npm run setup` otomatis membuat akun admin
# (password minimal 8 karakter). Lihat langkah 7.
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=ganti-dengan-password-aman
ADMIN_NAME=Admin XYZ
```

> `ML_SERVICE_BASE_URL` bersifat server-only — jangan gunakan prefix `NEXT_PUBLIC_`.

### 2. Buat Database

Buat database sesuai nama di `DATABASE_URL` (belum dibuat otomatis oleh setup). Pilih salah satu cara:

**a. psql** — jika `psql` tidak dikenali di Windows, tambahkan `C:\Program Files\PostgreSQL\<versi>\bin` ke PATH atau pakai "SQL Shell (psql)" dari Start Menu:

```bash
psql -U postgres -c "CREATE DATABASE rentalmobil;"
```

**b. Docker** — jika PostgreSQL berjalan di dalam container:

```bash
docker exec -it <nama-container-postgres> psql -U postgres -c "CREATE DATABASE rentalmobil;"
```

**c. GUI** — pgAdmin / DBeaver / TablePlus: buat koneksi ke server lokal, lalu klik kanan *Databases* → *Create* → tulis `rentalmobil`.

Jika nama di `DATABASE_URL` berbeda, sesuaikan di semua perintah di atas.

### 3. Setup Database (Migrasi + Seed)

```bash
npm install
npm run setup
```

`npm run setup` menjalankan **migrasi + seed + verifikasi state** sekaligus, dengan ringkasan ✔/✘ dan diagnosis koneksi yang jelas saat gagal (PostgreSQL mati, kredensial salah, database tidak ada, dsb). Aman dijalankan ulang — semua tahap idempotent.

Yang dikerjakan `npm run setup`:

- 16 migrasi berurutan: baseline core tables (`users`, `cars`, `bookings`), tabel pricing v4 (`pricing_quotes`, `booking_price_snapshots`, `car_units`, `pricing_model_versions`, `holidays`), fondasi Better Auth, pembayaran transfer manual, enum status `EXPIRED`, perpanjangan sewa, denda keterlambatan, tarif denda konfigurabel, hingga `ml_sample_overrides` (label manual continuous learning)
- Seed demo: 8 mobil (city car, MPV, SUV) beserta 20 unit aktif — 2–3 unit per mobil dengan plat Indonesia realistis (migrasi `0008` + `0011`)
- Seed konfigurasi: model version `rf_adjustment_v4_final` (diaktifkan hanya bila belum ada model aktif lain) dan 17 hari libur nasional 2026
- Verifikasi: 13 tabel, holiday tepat 17 baris, tepat satu model aktif + baris baseline, katalog demo

Perintah per-komponen tetap tersedia: `npm run db:migrate`, `npm run db:seed`, `npm run verify:setup`, dan `npm run db:studio` untuk GUI data.

### 4. Artefak Model

Letakkan file model final di:

```
ml-service/artifacts/v4_final/dynamic_pricing_adjustment_rf_pipeline_v4.pkl
```

File `.pkl` (±340 MB) **tidak ditrack Git** dan harus tersedia secara lokal sebelum menjalankan ml-service.

### 5. Jalankan ML Service (FastAPI)

```bash
cd ml-service
python -m venv .venv-v4              # hanya pertama kali
source .venv-v4/bin/activate         # Windows: .venv-v4\Scripts\activate
pip install -r requirements-v4.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Server berjalan di `http://localhost:8000`. Pastikan ml-service aktif sebelum web app agar quote pricing berfungsi.

### 6. Jalankan Web App (Next.js)

```bash
# kembali ke root repo
npm run dev
```

Aplikasi tersedia di `http://localhost:3000`.

### 7. Akun Admin

**Cara otomatis (disarankan):** jika `ADMIN_EMAIL` + `ADMIN_PASSWORD` terisi di `.env` (langkah 1), perintah `npm run setup` / `npm run db:seed` otomatis membuat akun admin tersebut — password di-hash dengan fungsi hashing yang sama dengan proses login Better Auth, jadi langsung bisa dipakai. Seed ini idempotent: mengubah `ADMIN_PASSWORD` lalu menjalankan seed ulang akan merotasi password akun tersebut.

**Cara manual (alternatif):** registrasi lewat halaman `/register` selalu menghasilkan akun `CUSTOMER`. Untuk mempromosikannya:

```bash
psql -U postgres -d rentalmobil -c "UPDATE \"users\" SET \"role\" = 'ADMIN' WHERE email = 'email-kamu@example.com';"
```

Login dengan akun admin, lalu akses dashboard admin di `/admin`.

## 🔌 API Endpoints

### Web App (Next.js)

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/pricing/quotes` | Buat quote dynamic pricing v4 (15 menit kedaluwarsa) |
| GET | `/api/pricing/quotes/[quoteId]` | Detail quote |
| POST | `/api/bookings/from-quote` | Buat booking dari quote yang disetujui |
| POST | `/api/bookings/[bookingId]/payment-proof` | Upload bukti pembayaran |
| GET | `/api/cars` | Daftar katalog mobil |
| POST | `/api/admin/payments/[paymentId]/verify` | Verifikasi pembayaran (admin) |
| POST | `/api/admin/payments/[paymentId]/reject` | Tolak pembayaran (admin) |

> `POST /api/pricing/estimate` adalah endpoint legacy yang sudah dinonaktifkan (HTTP 410).

### ML Service (FastAPI)

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/health` | Status service & model |
| POST | `/v1/predict-price` | Prediksi `price_adjustment_pct` (kontrak v4) |
| POST | `/predict_price` | Legacy — dinonaktifkan (HTTP 410) |

## 🧠 Cara Kerja Dynamic Pricing v4

1. **Input customer** hanya: `carId`, `pickupDate`, `durationDays`, dan `tripType` (`dalam_kota` / `luar_kota`).
2. **Backend menghitung** variabel turunan: `availabilityRatio`, `utilizationRate`, `demandLevel` (`sepi`/`normal`/`ramai`), `isWeekend`, `isHoliday`, `isPeakSeason`, `bookingLeadDays`.
3. **Model Random Forest** memprediksi `price_adjustment_pct` dari 8 fitur: `vehicle_category`, `trip_type`, `duration_days`, `is_weekend`, `is_holiday`, `is_peak_season`, `utilization_rate`, `booking_lead_days`.
4. **Harga akhir** dihitung dan dibulatkan ke kelipatan **Rp 1.000**:

   ```
   dynamicPriceRawPerDay     = basePricePerDay × (1 + predictedPriceAdjustmentPct)
   dynamicPriceDisplayPerDay = round(dynamicPriceRawPerDay / 1000) × 1000
   totalInvoiceDisplay       = dynamicPriceDisplayPerDay × durationDays
   ```

5. **Pricing snapshot** (harga yang disetujui customer) disimpan immutable di `booking_price_snapshots` dan tidak dihitung ulang.

## 🚶 Alur Demo

**Customer:** buka katalog → pilih mobil → isi form quote (tanggal, durasi, tipe trip) → hitung harga → review invoice → login/register → konfirmasi booking → upload bukti bayar → tunggu verifikasi admin.

**Admin:** login dengan akun `role = 'ADMIN'` (lihat langkah 7) → dashboard `/admin` → antrean `/admin/payments` → verifikasi/tolak pembayaran.

## 🧪 Testing

```bash
npm run test         # Unit + integration tests (sebagian butuh PostgreSQL aktif)
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm run build        # Production build
npm run verify:setup # Cek hasil migrate + seed terhadap database aktif

cd ml-service
pytest               # Test inference contract v4
```

CI (`.github/workflows/ci.yml`) menjalankan dua job: **Web App** (typecheck, lint, build) dan **DB Migrate + Seed** — job kedua menyiapkan PostgreSQL 15 throwaway lalu menjalankan `npm run setup` **dua kali** (run kedua membuktikan idempotensi penuh), sehingga regresi setup tertangkap otomatis di setiap PR dan push.

## 🤖 Retrain & Evaluasi Ulang Model (ml-service)

Semua script ML dijalankan dari direktori `ml-service/` memakai venv `.venv-v4`:

```bash
# Evaluasi ulang 3 split (70/30, 80/20, 90/10) untuk halaman admin
# Machine Learning — menimpa artefak di ml-service/artifacts/ml_evaluation/
./.venv-v4/Scripts/python.exe scripts/generate_ml_evaluation_artifacts.py

# Retrain model produksi ke .pkl — default menulis ke artifacts/v4_final_staging/
# (artefak produksi TIDAK disentuh). Tambah --commit untuk menimpa artefak
# produksi + metadata, lalu restart ml-service.
./.venv-v4/Scripts/python.exe scripts/retrain_v4_model.py
./.venv-v4/Scripts/python.exe scripts/retrain_v4_model.py --commit

# Demo determinisme: dua run dengan seed identik vs dua run tanpa seed
./.venv-v4/Scripts/python.exe scripts/_demo_seed_contrast.py
```

Keduanya bersifat **reproducible**: seed `random_state=42` dikunci pada split (group-based per kendaraan) maupun model Random Forest, sehingga angka yang dihasilkan identik dengan yang tampil di halaman admin. Antar-run, `generate_ml_evaluation_artifacts.py` praktis hanya mengubah field `generatedAt` (perbedaan sisanya noise floating-point di digit terakhir, tidak mengubah angka material); `retrain_v4_model.py` menghasilkan model dengan prediksi identik terhadap artefak produksi (metrik MAE/RMSE/R² sama sampai digit terakhir).

Artefak versi hasil retrain live di `ml-service/artifacts/versions/` otomatis dipangkas oleh ml-service setelah aktivasi sukses: maksimal 3 versi terbaru disimpan (versi aktif selalu aman) karena tiap versi ±340MB.

## 📚 Dokumentasi Lanjutan

- [`docs/DEVELOPMENT_RUNBOOK.md`](docs/DEVELOPMENT_RUNBOOK.md) — runbook lengkap (setup, troubleshooting, catatan teknis)
- [`docs/BLACK_BOX_TEST_SCENARIOS.md`](docs/BLACK_BOX_TEST_SCENARIOS.md) — skenario pengujian black box
- [`ml-service/artifacts/v4_final/`](ml-service/artifacts/v4_final/) — metadata training & evaluasi model

## ⚠️ Batasan Saat Ini

- Belum ada notifikasi email.
- Bukti pembayaran disimpan di disk lokal (`storage/`), belum cloud storage.
- Kedaluwarsa quote/pembayaran bersifat *lazy* (dicek saat request), belum ada background job/cron.
- Sebagian halaman admin masih mock/hardcoded.
- Belum ada rate limiting.

---

*Dibangun untuk keperluan skripsi: Implementasi Algoritma Random Forest pada Rekomendasi Dynamic Pricing — Sistem Informasi Rental Mobil XYZ.*
