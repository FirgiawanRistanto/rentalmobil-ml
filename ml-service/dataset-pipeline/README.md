# Dataset Pipeline — dari Kaggle sampai Model v4

> Folder ini adalah **provenance chain** skripsi: bukti bahwa dataset simulasi
> dibangun dengan aturan eksplisit dan reproducible, bukan angka asal.

## Urutan pipeline

```
CarRentalData.csv (Kaggle, 5.851 baris)
        │  adapt_kaggle_to_rental_xyz_v4.py   (rule-based labeling, seed 42)
        ▼
car_rental_xyz_dynamic_pricing_v4.csv (12 transaksi simulasi × 3.424 kendaraan = 41.088 baris)
        │  train_random_forest_adjustment_v4.py / train_v4_on_colab.ipynb
        ▼
dynamic_pricing_adjustment_rf_pipeline_v4.pkl  →  ml-service/artifacts/v4_final/
        │  dimuat oleh FastAPI service (ml-service/app/model_loader.py)
        ▼
POST /v1/predict-price  →  quote dynamic pricing di web app
```

## Isi folder

| File | Fungsi |
|---|---|
| `adapt_kaggle_to_rental_xyz_v4.py` | Script adaptasi + **rule-based labeling**: filter katalog (mobil mewah/listrik/truck dikecualikan), mapping harga ke IDR berbasis persentil, sampling 12 konteks sewa per kendaraan (4 per band utilization), lalu label `price_adjustment_pct` dari komponen aturan eksplisit (utilization piecewise-linear, weekend/holiday/peak/trip/durasi/lead, 5 interaksi) + variasi operasional ±2,5% + clamp [−32%, +52%] |
| `train_random_forest_adjustment_v4.py` | Training asli: grid search 72 kandidat × 5-fold CV, split group-based per kendaraan, seed 42 |
| `train_v4_on_colab.ipynb` | Versi notebook untuk eksekusi di Google Colab (environment training asli) |
| `car_rental_xyz_label_metadata_v4.json` | Metadata label: aturan demand, kontrak fitur, daftar kolom yang **dilarang** jadi fitur (anti data leakage) |
| `car_rental_xyz_vehicle_audit_v4.csv` | Audit keputusan include/exclude tiap listing sumber |
| `praktisi_validation_cases_v4.csv` | 36 kasus validasi praktisi (status: belum divalidasi — limitasi yang diakui) |
| `PRICING_CONTEXT_CONTRACT_V4.md` | Kontrak konteks pricing antara backend, model, dan UI |
| `v4_consistency_check.json` | Bukti konsistensi: 0 mismatch availability↔utilization dan demand↔utilization |

## Disiplin metodologi (untuk pertahanan sidang)

1. **Konsistensi simulasi ↔ implementasi** — threshold demand (sepi ≤30%, ramai ≥70%) identik antara script pelabel dan backend website (`implementation_note` di metadata).
2. **Anti data leakage** — komponen pembentuk label (`component_*`, `operational_variation_pct`) dan kolom turunannya **dilarang** menjadi fitur model; daftar larangannya eksplisit di metadata (`features_not_permitted_for_training`).
3. **Balanced sampling** — tiap band demand tepat 13.696 baris (sepertiga), median utilization 0,503 di tengah band normal.
4. **Deterministik** — seed 42 di pelabel, split, dan model; dataset hasil eksekusi terverifikasi identik (SHA-1 `7030010c…`) dengan `ml-service/datasets/car_rental_xyz_dynamic_pricing_v4.csv` yang dipakai training dan service.

## Catatan

- `CarRentalData.csv` (sumber Kaggle, ±7 MB) tidak disertakan di repo — unduh dari sumber sekunder yang dirujuk di skripsi, letakkan satu level di atas folder ini untuk menjalankan ulang `adapt_kaggle_to_rental_xyz_v4.py`.
- Komponen label tersimpan di dataset untuk **audit saja** — model dilatih hanya dengan 8 fitur kontrak v4.
