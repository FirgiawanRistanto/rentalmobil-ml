# Black-Box Test Scenarios — Rental Mobil XYZ v4

> Versi: Fase 10C.1
> Status screenshot: **Belum didokumentasikan** (perlu diambil saat demo)

---

## Legenda Status

| Status | Keterangan |
|--------|-----------|
| ✅ Automated | Tercakup oleh unit/integration test otomatis |
| 📸 Manual | Perlu diuji manual dengan screenshot |
| ⚠️ Partial | Sebagian otomatis, butuh verifikasi manual |
| ❌ Belum | Belum ada coverage |

---

## Skenario A — Customer Flow (Happy Path)

| # | Skenario | Langkah | Expected Result | Status |
|---|---------|---------|----------------|--------|
| A1 | Lihat katalog mobil | Buka `/katalog` | Grid mobil dari DB tampil | 📸 Manual |
| A2 | Lihat detail mobil | Klik mobil di katalog | Halaman detail + form harga tampil | 📸 Manual |
| A3 | Hitung harga dynamic | Isi form: tanggal, durasi, trip type → Submit | Invoice dengan harga v4 muncul (bukan error) | ⚠️ Partial |
| A4 | Invoice preview | Setelah A3 | Tampil: base price, penyesuaian %, harga final per hari, total | 📸 Manual |
| A5 | Konfirmasi booking tanpa login | Klik Konfirmasi di invoice | Redirect ke login dengan callbackURL | ✅ Automated |
| A6 | Register customer | Isi form register | Akun dibuat, redirect ke dashboard | 📸 Manual |
| A7 | Login customer | Isi form login | Session aktif, redirect ke dashboard | 📸 Manual |
| A8 | Konfirmasi booking setelah login | Ulang A3-A4 setelah login | Booking dibuat, price snapshot tersimpan | ⚠️ Partial |
| A9 | Booking muncul di dashboard | Buka `/dashboard` | Booking terbaru tampil dengan status PENDING | ✅ Automated |
| A10 | Upload bukti pembayaran | Di dashboard, klik Bayar → upload gambar | Status berubah ke SUBMITTED | 📸 Manual |
| A11 | Quote kedaluwarsa | Tunggu 15 menit lalu coba konfirmasi | Error: quote expired | ✅ Automated |

---

## Skenario B — Admin Flow (Happy Path)

| # | Skenario | Langkah | Expected Result | Status |
|---|---------|---------|----------------|--------|
| B1 | Login admin | Login dengan role ADMIN | Dashboard admin tampil | 📸 Manual |
| B2 | Dashboard ringkasan | Buka `/admin` | Metrik: total booking, menunggu payment, konfirmasi, fleet | ✅ Automated |
| B3 | Lihat antrean payment | Buka `/admin/payments` | List submission pembayaran | 📸 Manual |
| B4 | Verify pembayaran | Klik payment → Verify | Status booking → CONFIRMED, payment → VERIFIED | ⚠️ Partial |
| B5 | Reject pembayaran | Klik payment → Reject + isi alasan | Status payment → REJECTED | ⚠️ Partial |
| B6 | Akses admin oleh customer | Login customer → buka `/admin` | Redirect ke `/dashboard` | ✅ Automated |
| B7 | Akses admin tanpa login | Buka `/admin` tanpa session | Redirect ke `/login?callbackURL=/admin` | ✅ Automated |

---

## Skenario C — Legacy Isolation (Regression)

| # | Skenario | Langkah | Expected Result | Status |
|---|---------|---------|----------------|--------|
| C1 | Legacy pricing estimate | `POST /api/pricing/estimate` | 410 dengan `LEGACY_PRICING_ESTIMATE_DEPRECATED` | ✅ Automated |
| C2 | Legacy booking POST | `POST /api/bookings` | 410 dengan `LEGACY_BOOKINGS_API_DEPRECATED` | ✅ Automated |
| C3 | Legacy booking GET | `GET /api/bookings` | 410 dengan `LEGACY_BOOKINGS_API_DEPRECATED` | ✅ Automated |
| C4 | Legacy booking page | Buka `/booking/fortuner` | Redirect ke `/katalog/fortuner` | ✅ Automated |
| C5 | Legacy payment page | Buka `/payment/<bookingId>` | Redirect ke `/booking/payment/<bookingId>` | ✅ Automated |

---

## Skenario D — Security Hardening

| # | Skenario | Langkah | Expected Result | Status |
|---|---------|---------|----------------|--------|
| D1 | POST /api/cars tanpa auth | `POST /api/cars` dengan payload mobil | 405 dengan `CAR_CREATE_NOT_ALLOWED` | ✅ Automated |
| D2 | GET /api/cars publik | `GET /api/cars` | 200 dengan list mobil | ✅ Automated |
| D3 | test-api page removed | Buka `/test-api` | 404 (page tidak ditemukan) | ✅ Automated |
| D4 | Orphan services deleted | Cek filesystem | `pricingService.ts` tidak ada | ✅ Automated |
| D5 | Orphan services deleted | Cek filesystem | `bookingService.ts` tidak ada | ✅ Automated |

---

## Skenario E — Pricing Integrity

| # | Skenario | Langkah | Expected Result | Status |
|---|---------|---------|----------------|--------|
| E1 | Pembulatan harga Rp 1.000 | Lihat invoice | Harga per hari kelipatan 1.000 | ✅ Automated |
| E2 | Price snapshot immutable | Konfirmasi booking → cek DB | `booking_price_snapshots` berisi snapshot, tidak berubah setelah booking | ✅ Automated |
| E3 | Double booking dari 1 quote | Konfirmasi 2x dari quote sama | Error: quote sudah ACCEPTED | ✅ Automated |
| E4 | Kalkulasi utilization rate | Buat beberapa booking → hitung harga baru | `utilization_rate` berubah sesuai booking aktif periode | ⚠️ Partial |
| E5 | demandLevel derivasi | `utilizationRate <= 0.30` | demandLevel = `sepi` | ✅ Automated |
| E6 | demandLevel derivasi | `utilizationRate > 0.30 && < 0.70` | demandLevel = `normal` | ✅ Automated |
| E7 | demandLevel derivasi | `utilizationRate >= 0.70` | demandLevel = `ramai` | ✅ Automated |
| E8 | is_weekend detection | Quote pada hari Sabtu/Minggu | `isWeekend = true` di snapshot | ⚠️ Partial |
| E9 | is_holiday detection | Quote pada tanggal holiday di DB | `isHoliday = true` di snapshot | ⚠️ Partial |
| E10 | bookingLeadDays = 0 | Quote untuk hari ini | `bookingLeadDays = 0` | ✅ Automated |

---

## Skenario F — Timestamp & Expiry

| # | Skenario | Langkah | Expected Result | Status |
|---|---------|---------|----------------|--------|
| F1 | reservationExpiresAt tersimpan | Buat booking → cek DB | `reservationExpiresAt` bertipe `timestamptz` | ✅ Automated |
| F2 | reviewExpiresAt tersimpan | Submit payment → cek DB | `reviewExpiresAt` bertipe `timestamptz` | ✅ Automated |
| F3 | Quote expire 15 menit | Tunggu > 15 menit → coba confirm | Error: quote expired | ✅ Automated |
| F4 | Payment review expire | Admin tidak review dalam window → cek status | Payment status `EXPIRED` pada query berikutnya | ⚠️ Partial |

---

## Catatan Pengambilan Screenshot

Semua skenario dengan status **📸 Manual** harus diambil screenshot-nya saat demo. Lihat `BAB_IV_SCREENSHOT_CHECKLIST.md` untuk daftar lengkap dan caption akademik.

Data sensitif yang harus disamarkan sebelum screenshot masuk laporan:
- Email akun demo
- Nomor telepon
- Nama lengkap akun demo
- ID booking (UUID penuh)
