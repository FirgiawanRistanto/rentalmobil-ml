# Rental Mobil XYZ - Project Engineering Rules

## 1. Project Context
Aplikasi ini merupakan Sistem Informasi Rental Mobil XYZ untuk skripsi implementasi algoritma Random Forest pada rekomendasi dynamic pricing.

Rental Mobil XYZ merupakan objek simulasi. Dataset machine learning berasal dari dataset sekunder Kaggle yang telah melalui adaptasi, perluasan transaksi simulasi, dan pembentukan label price_adjustment_pct.

Model tidak diklaim memprediksi harga pasar nyata secara optimal. Model digunakan untuk memberikan rekomendasi penyesuaian harga pada sistem informasi berdasarkan kondisi penyewaan dan tingkat utilisasi armada.

## 2. Fixed Technology Stack
Pertahankan stack existing:
- Next.js App Router untuk web application.
- FastAPI untuk ML inference service.
- Drizzle ORM untuk akses PostgreSQL.
- PostgreSQL sebagai database.
- Better Auth sebagai authentication system.

Jangan mengganti framework, ORM, database, authentication library, atau arsitektur utama tanpa penjelasan tertulis mengenai masalah kritis yang tidak dapat diselesaikan dengan stack saat ini.

## 3. Existing Repository Constraints
Repository saat ini telah memiliki:
- tabel users
- tabel cars
- tabel bookings
- Next.js API routes
- FastAPI ml-service
- Better Auth configuration

Aturan refactor berikut harus mengikuti struktur existing:
- Pertahankan tabel `cars` sebagai tabel katalog kendaraan, kecuali ditemukan alasan kritis untuk rename.
- Jangan melakukan rename besar dari `cars` menjadi `vehicles` hanya demi menyamakan istilah desain.
- Nantinya tambahkan tabel unit fisik kendaraan, dengan nama yang mengikuti convention repository, disarankan `car_units`.
- Jangan menghapus schema, migration, atau data existing tanpa alasan dan rencana migrasi aman.
- Jangan merusak relasi `bookings.userId` terhadap `users.id`.

## 4. Dynamic Pricing Model Contract v4

### 4.1 Model Target
Model Random Forest v4 memprediksi:

`price_adjustment_pct`

Model tidak memprediksi harga akhir secara langsung.

### 4.2 Input Customer
Customer hanya boleh menginput:
- carId
- pickupDate
- durationDays
- tripType: `dalam_kota` atau `luar_kota`

Customer tidak boleh memilih atau menginput:
- availabilityRatio
- utilizationRate
- demandLevel
- isWeekend
- isHoliday
- isPeakSeason
- bookingLeadDays

Semua variabel tersebut harus dihitung oleh backend.

### 4.3 Availability and Utilization
Backend harus menghitung:

`availabilityRatio = availableUnits / activeUnits`

`utilizationRate = 1 - availabilityRatio`

Ketersediaan harus dihitung berdasarkan periode booking, bukan menggunakan flag global `cars.isAvailable` sebagai satu-satunya sumber kebenaran.

Booking yang memblokir ketersediaan nantinya adalah booking aktif dalam status pembayaran/konfirmasi/penyewaan sesuai enum final yang akan ditetapkan pada fase schema.

### 4.4 Demand Level
Demand level hanya status bisnis turunan untuk ditampilkan dan disimpan sebagai snapshot.

Aturannya:

- `sepi` jika `utilizationRate <= 0.30`
- `normal` jika `utilizationRate > 0.30 && utilizationRate < 0.70`
- `ramai` jika `utilizationRate >= 0.70`

`demandLevel` bukan input manual customer.

### 4.5 Input Model Random Forest v4
FastAPI hanya mengirim fitur prediksi berikut ke pipeline model:

- vehicle_category
- trip_type
- duration_days
- is_weekend
- is_holiday
- is_peak_season
- utilization_rate
- booking_lead_days

Catatan:
- `vehicle_category` berasal dari kategori pada tabel `cars`.
- `base_price_idr_per_day` diperlukan untuk post-processing harga, tetapi bukan fitur prediksi model v4.
- `availability_ratio` dan `demand_level` boleh disimpan atau ditampilkan, tetapi bukan fitur model karena sudah direpresentasikan oleh `utilization_rate`.
- Nama brand/model mobil tidak menjadi fitur model.

### 4.6 Price Calculation
Setelah FastAPI memprediksi `predictedPriceAdjustmentPct`, harga dihitung sebagai berikut:

`dynamicPriceRawPerDay = basePricePerDay * (1 + predictedPriceAdjustmentPct)`

Harga tampilan website dibulatkan ke kelipatan Rp1.000 terdekat:

`dynamicPriceDisplayPerDay = round(dynamicPriceRawPerDay / 1000) * 1000`

Total invoice:

`totalInvoiceDisplay = dynamicPriceDisplayPerDay * durationDays`

Jangan menggunakan pembulatan Rp50.000.

### 4.7 Pricing Snapshot
Harga yang telah ditampilkan dan disetujui customer wajib disimpan sebagai snapshot.

Snapshot minimal harus menyimpan:
- basePricePerDay
- activeUnits
- availableUnits
- availabilityRatio
- utilizationRate
- demandLevel
- predictedPriceAdjustmentPct
- dynamicPriceRawPerDay
- dynamicPriceDisplayPerDay
- totalInvoiceDisplay
- pricingReasons
- modelVersion
- createdAt

Setelah customer menyetujui invoice dan melanjutkan booking, sistem tidak boleh menghitung ulang harga secara diam-diam tanpa persetujuan customer.

## 5. Legacy ML Rules
Logic lama berikut dianggap deprecated dan harus diganti bertahap:
- Model yang memprediksi `estimated_price` atau harga akhir langsung.
- Input model lama seperti `vehicle_model`, `vehicle_year`, `rating`, `month`, `day_of_week`, atau `is_peak_month`.
- Pricing service yang meng-hardcode `trip_type`, holiday, tanggal, atau kondisi demand.
- Pembulatan harga ke Rp50.000.

Jangan langsung menghapus implementasi lama pada fase dokumentasi ini. Tandai sebagai area refactor untuk fase berikutnya.

## 6. Authentication Rules
- Better Auth tetap digunakan.
- Jangan mengganti Better Auth dengan auth library lain.
- Jangan mengubah atau menghapus tabel `users` existing tanpa memeriksa relasi booking.
- Implementasi sign-in, sign-up, session protection, serta kebutuhan tabel Better Auth dikerjakan pada fase terpisah.
- Booking final dan dashboard customer nantinya wajib memakai session user yang valid.

## 7. Implementation Order
Perubahan harus dilakukan bertahap dan mudah direview dalam urutan berikut:

1. Dokumentasi aturan proyek dan kontrak pricing v4.
2. Schema/migration aman untuk inventory unit, pricing snapshot, booking fields, holiday, dan model version.
3. Backend pricing context service untuk availability/utilization/demand.
4. FastAPI inference contract v4 dengan mode mock sebelum artefak final tersedia.
5. API pricing estimate Next.js yang menghubungkan DB context ke FastAPI.
6. Halaman customer cek harga dan invoice preview.
7. Booking creation berbasis pricing snapshot.
8. Payment/dashboard/admin berbasis data nyata.
9. Penyempurnaan Better Auth dan proteksi route.
10. Integrasi artefak model Random Forest v4 final.
11. Testing end-to-end dan dokumentasi skripsi.

## 8. Engineering Quality Rules
Pada setiap fase implementasi kode:
- Baca schema dan implementation existing sebelum patch.
- Pertahankan naming/style existing apabila masih masuk akal.
- Buat perubahan kecil, bukan rewrite besar.
- Jangan menyimpan harga dinamis hanya di client.
- Jangan menghitung availability hanya dari flag global katalog mobil.
- Tambahkan unit test/integration test pada service baru.
- Jalankan lint, typecheck, test, dan build yang relevan.
- Laporkan file yang berubah, migration yang dibuat, test yang dijalankan, serta risiko tersisa.
