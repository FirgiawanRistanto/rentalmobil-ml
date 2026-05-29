# Bab IV — Screenshot Checklist untuk Skripsi

> Dokumen ini digunakan sebagai panduan pengambilan screenshot untuk Bab IV (Implementasi dan Pengujian) skripsi.
> Status: **Belum diambil** — semua screenshot harus diambil saat demo/uji manual.

---

## Petunjuk Umum

- Pastikan browser dalam kondisi **bersih** (tidak ada console error, tidak ada DevTools terbuka)
- Gunakan resolusi minimal **1280×800**
- Gunakan data demo yang tidak mengandung data pribadi nyata
- Samakan semua data yang perlu disamarkan (lihat kolom "Data Disamarkan")
- Format file: **PNG**, nama file mengikuti nomor checklist (mis. `SS-C01.png`)
- Simpan di folder skripsi, bukan di repositori

---

## Bagian C — Flow Customer

| Kode | Halaman / Aksi | Tujuan Gambar | Data Disamarkan | Caption Akademik |
|------|---------------|--------------|----------------|-----------------|
| SS-C01 | `/katalog` — grid mobil | Menunjukkan katalog armada dari database | — | Halaman katalog menampilkan daftar armada yang diambil dari tabel `cars` secara dinamis |
| SS-C02 | `/katalog/<id>` — detail mobil | Menunjukkan halaman detail armada | — | Halaman detail kendaraan menampilkan spesifikasi dan formulir perhitungan harga |
| SS-C03 | Form pricing quote (sebelum submit) | Menunjukkan input customer: tanggal, durasi, tipe trip | — | Formulir permintaan estimasi harga Dynamic Pricing v4 |
| SS-C04 | Invoice preview (setelah hitung harga) | Menunjukkan hasil pricing v4: base price, adjustment%, harga final | — | Pratinjau invoice dengan harga dinamis hasil prediksi model Random Forest v4 |
| SS-C05 | `/booking/confirm?quoteId=...` — halaman konfirmasi | Menunjukkan detail booking yang akan dikonfirmasi | UUID quoteId | Halaman konfirmasi booking berbasis pricing quote yang belum kedaluwarsa |
| SS-C06 | `/dashboard` — daftar booking customer | Menunjukkan booking customer dengan status | Email, nama akun | Dashboard customer menampilkan riwayat dan status booking dari data nyata |
| SS-C07 | `/booking/payment/<bookingId>` — form upload bukti | Menunjukkan form upload bukti pembayaran | — | Halaman submission bukti transfer manual customer |
| SS-C08 | Notifikasi sukses setelah upload | Menunjukkan konfirmasi pembayaran tersubmit | — | Konfirmasi submission bukti pembayaran berhasil |

---

## Bagian D — Flow Admin

| Kode | Halaman / Aksi | Tujuan Gambar | Data Disamarkan | Caption Akademik |
|------|---------------|--------------|----------------|-----------------|
| SS-D01 | `/admin` — dashboard utama | Menunjukkan metrik operasional: booking, payment, armada | — | Dashboard admin menampilkan ringkasan operasional dari data transaksi nyata |
| SS-D02 | `/admin/payments` — antrean pembayaran | Menunjukkan list submission yang menunggu verifikasi | Email, nama customer | Antrean verifikasi pembayaran manual dengan data dari tabel `booking_payments` |
| SS-D03 | Detail payment + tombol Verify/Reject | Menunjukkan bukti pembayaran dan tombol aksi admin | Email, nama, nominal (opsional) | Antarmuka verifikasi pembayaran manual oleh admin |
| SS-D04 | Setelah verify — status berubah | Menunjukkan status booking → CONFIRMED | — | Perubahan status booking menjadi CONFIRMED setelah verifikasi admin |
| SS-D05 | Setelah reject + alasan | Menunjukkan pembayaran ditolak dengan alasan | — | Penolakan pembayaran oleh admin dengan keterangan alasan |

---

## Bagian E — Pricing & ML

| Kode | Halaman / Aksi | Tujuan Gambar | Data Disamarkan | Caption Akademik |
|------|---------------|--------------|----------------|-----------------|
| SS-E01 | Invoice dengan demand level "ramai" | Menunjukkan efek utilization tinggi pada harga | — | Penyesuaian harga positif saat tingkat utilisasi armada tinggi (`ramai`) |
| SS-E02 | Invoice dengan demand level "sepi" | Menunjukkan efek utilization rendah pada harga | — | Penyesuaian harga saat tingkat utilisasi armada rendah (`sepi`) |
| SS-E03 | Invoice pada hari libur nasional | Menunjukkan pengaruh `is_holiday = true` | — | Pengaruh hari libur nasional terhadap rekomendasi harga |
| SS-E04 | Invoice weekend vs weekday (perbandingan) | Menunjukkan perbedaan harga hari kerja vs akhir pekan | — | Perbandingan rekomendasi harga hari kerja dan akhir pekan |
| SS-E05 | Data snapshot di database (Drizzle Studio / psql) | Menunjukkan tabel `booking_price_snapshots` | ID, relasi | Snapshot harga yang tersimpan secara immutable setelah konfirmasi booking |

---

## Bagian T — Teknis / Arsitektur

| Kode | Konten | Tujuan Gambar | Caption Akademik |
|------|--------|--------------|-----------------|
| SS-T01 | Diagram arsitektur sistem (buat manual) | Menunjukkan komponen: Next.js, FastAPI, PostgreSQL, Better Auth | Arsitektur sistem informasi rental dengan komponen ML inference |
| SS-T02 | Skema ERD (buat dari schema.ts) | Menunjukkan relasi tabel utama | Entity Relationship Diagram skema database |
| SS-T03 | Output `npm run test` (terminal) | Menunjukkan hasil test suite | Hasil eksekusi unit test dan integration test |
| SS-T04 | Output FastAPI `/docs` (Swagger UI) | Menunjukkan endpoint ml-service | Dokumentasi endpoint FastAPI ml-service |
| SS-T05 | `ml-service/artifacts/v4_final/training_metadata_adjustment_v4.json` | Menunjukkan metadata model v4 | Metadata model Random Forest v4 yang digunakan |

---

## Catatan Penting untuk Skripsi

1. **Jangan tampilkan UUID penuh** pada screenshot yang masuk laporan — cukup 8 karakter pertama (sudah diterapkan di dashboard).
2. **Nominal invoice pada screenshot** tidak perlu disamarkan kecuali berisi data transaksi nyata.
3. **Password dan secret key** tidak boleh muncul di screenshot dalam kondisi apapun.
4. **Foto profil** dan **nama lengkap akun demo** sebaiknya menggunakan data fiktif seperti "Admin Demo" dan "Customer Demo".
5. Screenshot **SS-T03** (test output) paling penting untuk membuktikan sistem telah diuji secara otomatis.
