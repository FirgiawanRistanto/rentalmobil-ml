# Kontrak Pricing Context V4 — Rental Mobil XYZ

## Tujuan
Dokumen ini menjadi satu sumber aturan bagi generator dataset, training Random Forest, FastAPI inference service, dan backend website.

## Alur kondisi pasar
1. Customer memilih mobil, tanggal mulai, durasi, dan jenis perjalanan.
2. Backend menghitung unit aktif dalam kategori kendaraan pada periode sewa.
3. Backend menghitung jumlah unit yang belum ter-booking pada periode tersebut.
4. Backend menghitung:

```text
availability_ratio = available_units / active_units
utilization_rate   = 1 - availability_ratio
```

5. Backend menentukan status permintaan:

| Kondisi | Aturan |
|---|---|
| `sepi` | `utilization_rate <= 0.30` |
| `normal` | `0.30 < utilization_rate < 0.70` |
| `ramai` | `utilization_rate >= 0.70` |

## Fitur yang masuk model Random Forest

```text
vehicle_category
trip_type
duration_days
is_weekend
is_holiday
is_peak_season
utilization_rate
booking_lead_days
```

`availability_ratio` dan `demand_level` tetap disimpan untuk audit/tampilan invoice, tetapi **tidak dimasukkan sebagai fitur model** karena merupakan informasi deterministik yang sudah direpresentasikan oleh `utilization_rate`.

## Target model

```text
price_adjustment_pct
```

Contoh `0.1250` berarti kenaikan harga `+12,50%`; `-0.0800` berarti penurunan `-8,00%`.

## Post-processing harga website

```text
dynamic_price_raw_per_day = round(base_price_idr_per_day * (1 + predicted_price_adjustment_pct))
dynamic_price_display_per_day = round(dynamic_price_raw_per_day / 1000) * 1000
total_invoice_display = dynamic_price_display_per_day * duration_days
```

Pembulatan Rp1.000 hanya untuk nominal yang ditampilkan dan disimpan sebagai snapshot invoice; evaluasi model tetap menggunakan target adjustment dan harga raw.

## Input ML service yang disarankan

```json
{
  "vehicle_category": "mpv",
  "trip_type": "luar_kota",
  "duration_days": 3,
  "is_weekend": 1,
  "is_holiday": 0,
  "is_peak_season": 1,
  "utilization_rate": 0.78,
  "booking_lead_days": 5,
  "base_price_idr_per_day": 400000
}
```

## Response ML service yang disarankan

```json
{
  "availability_ratio": 0.22,
  "utilization_rate": 0.78,
  "demand_level": "ramai",
  "predicted_price_adjustment_pct": 0.2185,
  "dynamic_price_raw_per_day": 487400,
  "dynamic_price_display_per_day": 487000,
  "total_invoice_display": 1461000,
  "model_version": "rf_adjustment_v4_final"
}
```

Catatan: `availability_ratio` dan `demand_level` idealnya berasal dari service booking/backend, lalu disertakan pada response invoice untuk penjelasan customer.

## Pemisahan data training/testing
Seluruh transaksi yang berasal dari `source_vehicle_id` yang sama harus hanya berada pada train atau test, tidak keduanya. Gunakan `GroupShuffleSplit` untuk holdout dan `GroupKFold` untuk cross-validation.

## Status metodologis
Dataset v4 merupakan dataset simulasi. Sebelum diposisikan sebagai rekomendasi kebijakan pricing yang final, rentang adjustment perlu divalidasi melalui lembar `praktisi_validation_cases_v4.csv` atau observasi harga pasar.
